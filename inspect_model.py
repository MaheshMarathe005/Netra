import torch
import sys

def inspect_model(path):
    try:
        data = torch.load(path, map_location='cpu')
        print("Keys in loaded dict:", data.keys() if isinstance(data, dict) else "Not a dict, is a model object")
        if isinstance(data, dict):
            for k, v in data.items():
                if isinstance(v, dict):
                    print(f"Key '{k}' contains a dict with {len(v)} elements")
                elif hasattr(v, 'shape'):
                    print(f"Key '{k}' is a tensor of shape {v.shape}")
                else:
                    print(f"Key '{k}' is of type {type(v)}")
        else:
            print("Model object type:", type(data))
    except Exception as e:
        print(f"Failed to load model: {e}")

if __name__ == '__main__':
    inspect_model('/home/mahesh/Desktop/netraui/netra-checkpoints/checkpoints/last.pt')
