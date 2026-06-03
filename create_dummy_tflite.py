import tensorflow as tf
import os

def create_dummy_model(name, input_shape, output_shape, model_dir):
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=input_shape),
        tf.keras.layers.Flatten(),
        tf.keras.layers.Dense(output_shape, activation='sigmoid')
    ])
    
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    tflite_model = converter.convert()
    
    os.makedirs(model_dir, exist_ok=True)
    with open(os.path.join(model_dir, f"{name}.tflite"), "wb") as f:
        f.write(tflite_model)
    print(f"Created {name}.tflite in {model_dir}")

def main():
    model_dir = "/home/mahesh/Desktop/netraui/assets/models"
    
    # BlazeFace (Face Detection) Dummy - Input: 128x128x3, Output: 896x16 (Boxes/Scores)
    create_dummy_model("blazeface", (128, 128, 3), 10, model_dir)
    
    # MobileFaceNet (Face Recognition) Dummy - Input: 112x112x3, Output: 128 (Embedding)
    create_dummy_model("mobilefacenet", (112, 112, 3), 128, model_dir)
    
    # MiniFASNet (Liveness Detection) Dummy - Input: 80x80x3, Output: 2 (Spoof vs Live)
    create_dummy_model("minifasnet", (80, 80, 3), 2, model_dir)

if __name__ == "__main__":
    main()
