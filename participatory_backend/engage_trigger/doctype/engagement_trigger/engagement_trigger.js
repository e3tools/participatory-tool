// Copyright (c) 2025, Steve Nyaga and contributors
// For license information, please see license.txt
cur_frm.add_fetch("engagement_form", "form_group", "form_group");

let UPDATEABLE_TYPES = [
  "Data",
  "Text",
  "Small Text",
  "Long Text",
  "Int",
  "Currency",
  "Float",
  "Date",
  "Datetime",
  "Select",
  "Percent",
  "Link",
];

frappe.ui.form.on("Engagement Trigger", {
  onload(frm) {
    frm.set_query("print_format", function () {
      return {
        filters: {
          doc_type: frm.doc.engagement_form,
        },
      };
    });
  },
  refresh(frm) {
    frm.trigger("engagement_form");
    frm.trigger("related_form");

    frm.add_fetch("sender", "email_id", "sender_email");
    frm.set_query("sender", () => {
      return {
        filters: {
          enable_outgoing: 1,
        },
      };
    });
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
            if (
              !frappe.model.no_value_type.includes(el.fieldtype) &&
              UPDATEABLE_TYPES.includes(el.fieldtype)
            ) {
              fields.push({
                label:
                  el.fieldname +
                  " (" +
                  __(el.label) +
                  " - " +
                  el.fieldtype +
                  ")",
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

          // frm.trigger("make_recipient_fields");
          make_recipient_fields(frm, r.message); // fields);
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
                label:
                  el.fieldname +
                  " (" +
                  __(el.label) +
                  " - " +
                  el.fieldtype +
                  ")",
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
  set_condition: function (frm) {
    let doc = frm.doc;
    if (!doc.engagement_form) {
      msgprint(__("You must select the Engagement Form first"));
      return;
    }
    edit_filters(frm, doc.engagement_form, doc.condition || "{}", (filters) => {
      frappe.model.set_value(doc.doctype, doc.name, "condition", filters);
    });
  },
  channel: function (frm) {
    frappe.call({
      method:
        "participatory_backend.engage.doctype.engagement_form.engagement_form.get_docfields",
      args: {
        doctype: frm.doc.engagement_form,
      },
      freeze: true,
      callback: function (r) {
        if (r.message) {
          make_recipient_fields(frm, r.message); // fields);
        }
      },
    });
  },
});

function edit_filters(frm, doctype, existing_filters, on_add_filter) {
  let field_doctype = doctype;
  //   const { frm } = store;
  make_filters_dialog(frm, on_add_filter);

  make_filters_area(frm, field_doctype);
  frappe.model.with_doctype(field_doctype, () => {
    frm.dialog.show();
    //  add_existing_filter(frm, child);

    if (existing_filters) {
      let filters = JSON.parse(existing_filters);
      if (filters) {
        frm.filter_group.add_filters_to_filter_group(filters);
      }
    }
  });
}

function make_filters_dialog(frm, /*child,*/ on_add_filter) {
  frm.dialog = new frappe.ui.Dialog({
    title: __("Set Filters"),
    fields: [
      {
        fieldtype: "HTML",
        fieldname: "filter_area",
      },
    ],
    primary_action: () => {
      //let fieldname = props.field.df.fieldname;
      //   let field_option = props.field.df.options;
      let filters = frm.filter_group.get_filters().map((filter) => {
        // last element is a boolean which hides the filter hence not required to store in meta
        filter.pop();

        // filter_group component requires options and frm.set_query requires fieldname so storing both
        // filter[0] = field_option;
        return filter;
      });

      let link_filters = JSON.stringify(filters);

      on_add_filter(link_filters);
      //   store.form.selected_field = props.field.df;

      /*
      frappe.model.set_value(
        child.doctype,
        child.name,
        "field_filters",
        link_filters
      );*/
      frm.dialog.hide();
    },
    primary_action_OLD: () => {
      //let fieldname = props.field.df.fieldname;
      //   let field_option = props.field.df.options;
      let filters = frm.filter_group.get_filters().map((filter) => {
        // last element is a boolean which hides the filter hence not required to store in meta
        filter.pop();

        // filter_group component requires options and frm.set_query requires fieldname so storing both
        // filter[0] = field_option;
        return filter;
      });

      let link_filters = JSON.stringify(filters);
      //   store.form.selected_field = props.field.df;
      frappe.model.set_value(
        child.doctype,
        child.name,
        "field_filters",
        link_filters
      );
      frm.dialog.hide();
    },
    primary_action_label: __("Apply"),
  });
}

function make_filters_area(frm, doctype) {
  frm.filter_group = new frappe.ui.FilterGroup({
    parent: frm.dialog.get_field("filter_area").$wrapper,
    doctype: doctype,
    on_change: () => {},
  });
}

function add_existing_filter(frm, child) {
  if (child.field_filters) {
    let filters = JSON.parse(child.field_filters);
    if (filters) {
      frm.filter_group.add_filters_to_filter_group(filters);
    }
  }
}

function edit_filters_link(frm, child) {
  let field_doctype = child.field_doctype;
  //   const { frm } = store;
  make_filters_dialog(frm, child);
  make_filters_area(frm, field_doctype);
  frappe.model.with_doctype(field_doctype, () => {
    frm.dialog.show();
    add_existing_filter(frm, child);
  });
}

function get_select_options(df, parent_field) {
  // Append parent_field name along with fieldname for child table fields
  let select_value = parent_field
    ? df.fieldname + "," + parent_field
    : df.fieldname;

  return {
    value: select_value,
    label: df.fieldname + " (" + __(df.label, null, df.parent) + ")",
  };
}

function make_recipient_fields(frm, fields) {
  let receiver_fields = [];
  if (frm.doc.channel === "Email") {
    receiver_fields = $.map(fields, function (d) {
      // Add User and Email fields from child into select dropdown
      if (frappe.model.table_fields.includes(d.fieldtype)) {
        let child_fields = frappe.get_doc("DocType", d.options).fields;
        return $.map(child_fields, function (df) {
          return df.options == "Email" ||
            (df.options == "User" && df.fieldtype == "Link")
            ? get_select_options(df, d.fieldname)
            : null;
        });
        // Add User and Email fields from parent into select dropdown
      } else {
        return d.options == "Email" ||
          (d.options == "User" && d.fieldtype == "Link")
          ? get_select_options(d)
          : null;
      }
    });
  } else if (["WhatsApp", "SMS"].includes(frm.doc.channel)) {
    receiver_fields = $.map(fields, function (d) {
      return d.options == "Phone" ? get_select_options(d) : null;
    });
  }

  // set email recipient options
  frm.fields_dict.recipients.grid.update_docfield_property(
    "receiver_by_document_field",
    "options",
    // [""].concat(["owner"]).concat(receiver_fields)
    [""].concat(receiver_fields)
  );
}

/**
 * Format JS filter into Python equivalent
 * Filter comes as an array e.g ["General Test Form","age","=",12]
 * @param {*} filter
 */
function format_filter_for_python(filter) {
  const field = `doc.${filter[1]}`;
  const operator = filter[2];
  const value = filter[3];
}

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
//                 // Populate the Select field with the received options
//                 cur_frm.set_df_property('field_to_update', 'options', result.message);
//                 cur_frm.refresh_field('field_to_update'); // Refresh to update the UI
//             }
//         });
//     }
// });
