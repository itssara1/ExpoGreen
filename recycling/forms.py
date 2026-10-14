from django import forms


class ImageTestForm(forms.Form):
    image = forms.ImageField(
        label="صورة المخلف",
        widget=forms.ClearableFileInput(
            attrs={"accept": "image/jpeg,image/png,image/webp"}
        ),
    )

    def clean_image(self):
        image = self.cleaned_data["image"]

        if image.size > 5 * 1024 * 1024:
            raise forms.ValidationError(
                "حجم الصورة لازم يكون 5 ميجابايت أو أقل."
            )

        return image