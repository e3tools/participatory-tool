import frappe


def add_docfield_customizations():
    # Check if the field already exists to prevent duplicate insertion
    if not frappe.db.exists(
        "Custom Field", {"dt": "DocField", "fieldname": "custom_formula"}
    ):
        doc = frappe.get_doc(
            {
                "doctype": "Custom Field",
                "dt": "DocField",  # Target DocType
                "fieldname": "custom_formula",
                "label": "Formula",
                "fieldtype": "Small Text",
                "insert_after": "description",
            }
        )
        doc.flags.ignore_permissions = True
        doc.flags.ignore_validate = True

        doc.insert(ignore_permissions=True)

        # Force a schema sync since DocField dictates layout generation
        frappe.db.commit()
