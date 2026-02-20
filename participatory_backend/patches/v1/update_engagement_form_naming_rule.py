import frappe


def execute():
    """
    Patch engagement form naming rules
    """
    forms = frappe.db.get_list(
        "Engagement Form",
        fields=["use_field_to_generate_id", "name"],
        order_by="modified asc",
    )
    for i, form in enumerate(forms):
        print(f"Processing Engagement Form: {form.name}")
        frappe.db.set_value(
            "Engagement Form",
            form.name,
            {
                "naming_rule": (
                    "By Fieldname" if form.use_field_to_generate_id else "Autoname"
                )
            },
            None,
            update_modified=False,
        )
