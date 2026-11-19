"""Convert Real-ESRGAN realesr-general-x4v3 (SRVGGNetCompact) .pth -> ONNX without PyTorch.

Usage: python3 esrgan_onnx.py realesr-general-x4v3.pth model.onnx
"""
import pickle
import sys
import zipfile

import numpy as np
import onnx
from onnx import TensorProto, helper, numpy_helper

DT = {'FloatStorage': np.float32, 'HalfStorage': np.float16, 'DoubleStorage': np.float64, 'LongStorage': np.int64}


def load_pth(path):
    z = zipfile.ZipFile(path)
    root = z.namelist()[0].split('/')[0]

    class StorageType:
        def __init__(self, name):
            self.name = name

    def rebuild_tensor_v2(storage, offset, size, stride, *args):
        dt, buf = storage
        arr = np.frombuffer(buf, dtype=dt)
        if not size:
            return arr[offset:offset + 1].reshape(())
        itemsize = arr.itemsize
        return np.lib.stride_tricks.as_strided(arr[offset:], shape=size, strides=[s * itemsize for s in stride]).copy()

    class U(pickle.Unpickler):
        def find_class(self, mod, name):
            if mod == 'torch._utils' and name == '_rebuild_tensor_v2':
                return rebuild_tensor_v2
            if mod == 'torch' and name.endswith('Storage'):
                return StorageType(name)
            if mod == 'collections' and name == 'OrderedDict':
                import collections
                return collections.OrderedDict
            raise pickle.UnpicklingError(f'blocked {mod}.{name}')

        def persistent_load(self, pid):
            _, st, key, _loc, _n = pid
            return (DT[st.name], z.read(f'{root}/data/{key}'))

    return U(z.open(f'{root}/data.pkl')).load()


def build(sd, out):
    p = sd.get('params', sd)
    nodes, inits = [], []
    cur, k = 'input', 0
    convs = sorted({int(n.split('.')[1]) for n in p if n.endswith('.bias')})
    for i in range(0, max(convs) + 1):
        w = p.get(f'body.{i}.weight')
        if w is None:
            continue
        if w.ndim == 4:
            inits += [numpy_helper.from_array(w.astype(np.float32), f'w{i}'), numpy_helper.from_array(p[f'body.{i}.bias'].astype(np.float32), f'b{i}')]
            nodes.append(helper.make_node('Conv', [cur, f'w{i}', f'b{i}'], [f'c{i}'], pads=[1, 1, 1, 1], kernel_shape=[3, 3]))
            cur = f'c{i}'
        else:  # PReLU slope
            inits.append(numpy_helper.from_array(w.reshape(-1, 1, 1).astype(np.float32), f's{i}'))
            nodes.append(helper.make_node('PRelu', [cur, f's{i}'], [f'p{i}']))
            cur = f'p{i}'
    nodes.append(helper.make_node('DepthToSpace', [cur], ['up'], blocksize=4, mode='CRD'))
    inits.append(numpy_helper.from_array(np.array([1, 1, 4, 4], np.float32), 'scales'))
    nodes.append(helper.make_node('Resize', ['input', '', 'scales'], ['base'], mode='nearest'))
    nodes.append(helper.make_node('Add', ['up', 'base'], ['output']))
    g = helper.make_graph(nodes, 'srvgg', [helper.make_tensor_value_info('input', TensorProto.FLOAT, [1, 3, 'h', 'w'])],
                          [helper.make_tensor_value_info('output', TensorProto.FLOAT, [1, 3, 'H', 'W'])], inits)
    m = helper.make_model(g, opset_imports=[helper.make_opsetid('', 17)], ir_version=8)
    onnx.checker.check_model(m)
    onnx.save(m, out)
    print('saved', out, 'convs', sum(1 for n in nodes if n.op_type == 'Conv'))


if __name__ == '__main__':
    build(load_pth(sys.argv[1]), sys.argv[2])
