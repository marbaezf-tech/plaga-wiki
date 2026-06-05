# 02 — Fine-tuning con LoRA

## ¿Qué es Fine-tuning?

Entrenar un modelo base (Qwen, Llama, Gemma) con TUS datos específicos para que aprenda tu dominio. LoRA (Low-Rank Adaptation) permite hacerlo con poca VRAM.

## Requisitos

- Python 3.11+
- CUDA (GPUs NVIDIA)
- Librerías: `pip install transformers peft trl datasets accelerate bitsandbytes`

## Preparar Dataset

Formato JSONL (un JSON por línea):

```jsonl
{"messages": [{"role": "system", "content": "Eres experto en mi juego"}, {"role": "user", "content": "¿Quién es el protagonista?"}, {"role": "assistant", "content": "El protagonista es..."}]}
{"messages": [{"role": "user", "content": "¿Cómo funciona el combate?"}, {"role": "assistant", "content": "El combate es por turnos..."}]}
```

## Script de Entrenamiento (Ejemplo Básico)

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import LoraConfig, get_peft_model
from trl import SFTTrainer, SFTConfig
from datasets import load_dataset

# Cargar modelo base
model_name = "Qwen/Qwen2.5-7B-Instruct"
model = AutoModelForCausalLM.from_pretrained(model_name, device_map="auto", load_in_4bit=True)
tokenizer = AutoTokenizer.from_pretrained(model_name)

# Configurar LoRA
lora_config = LoraConfig(
    r=16,              # Rango (8-64, más alto = más capacidad)
    lora_alpha=32,     # Factor de escala
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
    lora_dropout=0.05,
    task_type="CAUSAL_LM"
)

# Cargar dataset
dataset = load_dataset("json", data_files="mi_dataset.jsonl", split="train")

# Entrenar
training_args = SFTConfig(
    output_dir="./mi-modelo-output",
    num_train_epochs=3,
    per_device_train_batch_size=1,
    gradient_accumulation_steps=4,
    learning_rate=2e-4,
    logging_steps=10,
    save_steps=100,
)

trainer = SFTTrainer(
    model=model,
    args=training_args,
    train_dataset=dataset,
    peft_config=lora_config,
    tokenizer=tokenizer,
)

trainer.train()
trainer.save_model("./mi-modelo-output")
```

## Exportar a Ollama

1. Mergear LoRA con el modelo base
2. Convertir a GGUF (formato de Ollama)
3. Crear Modelfile apuntando al GGUF

```python
# merge_and_export.py
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

base = AutoModelForCausalLM.from_pretrained("Qwen/Qwen2.5-7B-Instruct")
model = PeftModel.from_pretrained(base, "./mi-modelo-output")
merged = model.merge_and_unload()
merged.save_pretrained("./mi-modelo-merged")
```

Luego convertir con llama.cpp:
```bash
python convert_hf_to_gguf.py ./mi-modelo-merged --outfile mi-modelo.gguf --outtype q4_k_m
```

Crear Modelfile:
```dockerfile
FROM ./mi-modelo.gguf
PARAMETER temperature 0.7
SYSTEM "Mi system prompt"
```

```bash
ollama create mi-modelo-trained -f Modelfile.mi-modelo
```

## Tips

- Empezá con datasets chicos (100-500 ejemplos) para probar
- Más épocas no siempre es mejor (3-5 es suficiente para dominios específicos)
- Si el modelo repite mucho, bajá las épocas o subí el learning rate
- Siempre guardá el dataset para poder re-entrenar
