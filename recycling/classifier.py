from functools import lru_cache

import torch
from PIL import Image, ImageOps
from transformers import (
    AutoImageProcessor,
    AutoModelForImageClassification,
)


MODEL_ID = "yangy50/garbage-classification"


@lru_cache(maxsize=1)
def load_classifier():
    processor = AutoImageProcessor.from_pretrained(MODEL_ID)
    model = AutoModelForImageClassification.from_pretrained(MODEL_ID)
    model.eval()
    return processor, model


def classify_image(uploaded_file):
    with Image.open(uploaded_file) as original:
        if original.format not in {"JPEG", "PNG", "WEBP"}:
            raise ValueError("Unsupported image format.")

        if original.width * original.height > 20_000_000:
            raise ValueError("Image dimensions are too large.")

        image = ImageOps.exif_transpose(original).convert("RGB")

    processor, model = load_classifier()
    inputs = processor(images=image, return_tensors="pt")

    with torch.inference_mode():
        outputs = model(**inputs)

    probabilities = outputs.logits.softmax(dim=-1)[0]
    scores, indices = probabilities.topk(3)

    return [
        {
            "label": model.config.id2label[index],
            "score": round(score * 100, 1),
        }
        for score, index in zip(
            scores.tolist(),
            indices.tolist(),
        )
    ]