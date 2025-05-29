// Copyright (c) 2025, Steve Nyaga and contributors
// For license information, please see license.txt

frappe.ui.form.on("Engagement Profile", {
  refresh(frm) {
    if (!frm.is_new()) {
      frm.add_custom_button(
        __("Assign users", [__(frm.doc.name)]),
        () => {
          const new_assignment = frappe.model.get_new_doc(
            "Engagement Profile User Assignment"
          );
          frappe.set_route(
            "Form",
            "Engagement Profile User Assignment",
            new_assignment.name,
            { engagement_profile: frm.doc.name }
          );
        },
        null //__("Assign")
      );
    }
  },
});
