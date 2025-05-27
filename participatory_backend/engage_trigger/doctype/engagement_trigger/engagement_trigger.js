// Copyright (c) 2025, Steve Nyaga and contributors
// For license information, please see license.txt
let UPDATEABLE_TYPES = [
  "Data",
  "Text",
  "Small Text",
  "Long Text",
  "Int",
  "Currency",
  "Float",
  "Date",
  "DateTime",
  "Select",
];

frappe.ui.form.on("Engagement Trigger", {
  refresh(frm) {
    frm.trigger("engagement_form");
    frm.trigger("related_form");
  },
  engagement_form: function (frm) {
    if (!frm.doc.engagement_form) {
      return;
    }
    frappe.call({
      method:
        "participatory_backend.engage.doctype.engagement_form.engagement_form.get_docfields",
      args: {
        doctype: frm.doc.engagement_form,
      },
      freeze: true,
      callback: function (r) {
        let fields = [
          {
            label: "ID",
            value: "name", // + " (" + __(el.label) + ")",
          },
        ];
        let link_fields = [];
        if (r.message) {
          r.message.forEach((el) => {
            if (!frappe.model.no_value_type.includes(el.fieldtype)) {
              fields.push({
                label: el.fieldname + " (" + __(el.label) + ")",
                value: el.fieldname, // + " (" + __(el.label) + ")",
              });
            }
            // Get a Link form that has the Engagement Form as options
            if (
              el.fieldtype === "Link" &&
              el.options === frm.doc.related_form
            ) {
              link_fields.push({
                label: el.fieldname + " (" + __(el.label) + ")",
                value: el.fieldname, // + " (" + __(el.label) + ")",
              });
            }
          });
          frm.fields_dict.set_property_after_trigger_items.grid.update_docfield_property(
            "field_to_update",
            "options",
            fields
          );
          frm.fields_dict.related_form_field_items.grid.update_docfield_property(
            "current_form_field",
            "options",
            fields
          );
          frm.set_df_property(
            "field_linking_forms",
            "options",
            link_fields,
            frm.doc.name
          );
          // load all except id field
          frm.set_df_property(
            "change_field",
            "options",
            fields.filter((el) => el.value != "name"),
            frm.doc.name
          );
        }
      },
    });
  },
  related_form: function (frm) {
    if (!frm.doc.related_form) {
      return;
    }
    frappe.call({
      method:
        "participatory_backend.engage.doctype.engagement_form.engagement_form.get_docfields",
      args: {
        doctype: frm.doc.related_form,
      },
      freeze: true,
      callback: function (r) {
        let fields = [];
        if (r.message) {
          r.message.forEach((el) => {
            if (!frappe.model.no_value_type.includes(el.fieldtype)) {
              fields.push({
                label: el.fieldname + " (" + __(el.label) + ")",
                value: el.fieldname, // + " (" + __(el.label) + ")",
              });
            }
          });
          frm.fields_dict.related_form_field_items.grid.update_docfield_property(
            "related_form_field",
            "options",
            fields
          );
        }
        frm.trigger("engagement_form"); //reload fields so as to select the linking field
      },
    });
  },
  outcome_type: function (frm) {
    if (frm.doc.outcome_type === "Update Another Form Record") {
      frm.trigger("related_form");
    }
  },
});

// frappe.ui.form.on("Engagement Trigger Update Field Item", {
// 	refresh(frm) {

// 	},
//     engagement_form: function(frm, cdt, cdn) { // cdt and cdn are related to the child table
//         var row = local[cdt][cdn];
//         // Make a call to the server-side function to get the options
//         frappe.call({
//             method: 'participatory_backend.engage.doctype.engagement_form.engagement_form.get_docfields',
//             args: {
//                 category: frm.doc.engagement_form // Assuming the category is in a field on the parent table
//             },
//             success: function(result) {
//                 debugger;
//                 // Populate the Select field with the received options
//                 cur_frm.set_df_property('field_to_update', 'options', result.message);
//                 cur_frm.refresh_field('field_to_update'); // Refresh to update the UI
//             }
//         });
//     }
// });
