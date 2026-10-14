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

class TicketCreateForm(forms.Form):
    name = forms.CharField(
        label="اسم الزائر",
        max_length=100,
        widget=forms.TextInput(
            attrs={
                "placeholder": "اكتب اسمك",
                "autocomplete": "name",
            }
        ),
    )

    def clean_name(self):
        name = " ".join(self.cleaned_data["name"].split())

        if len(name) < 2:
            raise forms.ValidationError(
                "اكتب اسمًا من حرفين على الأقل."
            )

        return name