import sys
sys.path.append('/home/mahesh/Desktop/netra_training')

import torch
from scripts.mobilefacenet import MobileFaceNet

def convert_pt_to_onnx(pt_path, onnx_path):
    print(f"Loading checkpoint from {pt_path}...")
    checkpoint = torch.load(pt_path, map_location='cpu')
    
    state_dict = checkpoint.get('model', checkpoint)
    
    # Initialize the model
    # MobileFaceNet default is embedding_dim=128
    model = MobileFaceNet(embedding_dim=128)
    
    # Remove module. prefix if it was trained with DataParallel
    new_state_dict = {}
    for k, v in state_dict.items():
        name = k.replace("module.", "") if k.startswith("module.") else k
        new_state_dict[name] = v
        
    model.load_state_dict(new_state_dict)
    model.eval()
    
    # Create dummy input with the right shape (1, 3, 112, 112)
    dummy_input = torch.randn(1, 3, 112, 112)
    
    print(f"Exporting to ONNX at {onnx_path}...")
    torch.onnx.export(
        model, 
        dummy_input, 
        onnx_path, 
        export_params=True, 
        opset_version=12,
        do_constant_folding=True,
        input_names=['input'], 
        output_names=['output'],
        dynamic_axes={'input': {0: 'batch_size'}, 'output': {0: 'batch_size'}}
    )
    print("ONNX export complete.")

if __name__ == '__main__':
    convert_pt_to_onnx(
        '/home/mahesh/Desktop/netraui/netra-checkpoints/checkpoints/last.pt',
        '/home/mahesh/Desktop/netraui/mobilefacenet.onnx'
    )
