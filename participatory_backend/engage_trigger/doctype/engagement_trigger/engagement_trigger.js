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
  "Linked Field",
  "Read Only",
];

let INITIAL_FORM = "";
let INITIAL_CONDITIONS = "";

frappe.ui.form.on("Engagement Trigger", {
  onload(frm) {
    frm.set_query("print_format", function () {
      return {
        filters: {
          doc_type: frm.doc.engagement_form,
        },
      };
    });

    //hide whatsapp
    frm.set_df_property("via_whatsapp", "hidden", true);

    // Get the values for currently loaded form
    INITIAL_FORM = frm.doc.engagement_form;
    INITIAL_CONDITIONS = frm.doc.conditions_plain;
    frm.trigger("setup_skip_conditions");
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

    // if (frm.doc.engagement_form === INITIAL_FORM) {
    //   INITIAL_CONDITIONS = frm.doc.conditions_plain;
    // }
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
                // label:
                //   __(el.label) +
                //   " - " +
                //   " (" +
                //   el.fieldtype +
                //   ") " +
                //   el.fieldname,
                label: make_field_display_value(el),
                value: el.fieldname, // + " (" + __(el.label) + ")",
              });
            }
            // Get a Link form that has the Engagement Form as options
            if (
              el.fieldtype === "Link" &&
              el.options === frm.doc.related_form
            ) {
              link_fields.push({
                label: __(el.label) + " - " + el.fieldname,
                value: el.fieldname, // + " (" + __(el.label) + ")",
              });
            }
          });
          fields.sort((a, b) =>
            a.label.toUpperCase() < b.label.toUpperCase() ? -1 : 1,
          );
          frm.fields_dict.set_property_after_trigger_items.grid.update_docfield_property(
            "field_to_update",
            "options",
            fields,
          );
          frm.fields_dict.related_form_field_items.grid.update_docfield_property(
            "current_form_field",
            "options",
            fields,
          );
          frm.set_df_property(
            "field_linking_forms",
            "options",
            link_fields,
            frm.doc.name,
          );
          // load all except id field
          frm.set_df_property(
            "change_field",
            "options",
            fields.filter((el) => el.value != "name"),
            frm.doc.name,
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
                // label:
                //   el.fieldname +
                //   " (" +
                //   __(el.label) +
                //   " - " +
                //   el.fieldtype +
                //   ")",
                label: make_field_display_value(el),
                value: el.fieldname, // + " (" + __(el.label) + ")",
              });
            }
          });
          fields.sort((a, b) =>
            a.label.toUpperCase() < b.label.toUpperCase() ? -1 : 1,
          );
          frm.fields_dict.related_form_field_items.grid.update_docfield_property(
            "related_form_field",
            "options",
            fields,
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
  setup: function (frm) {
    // frm.trigger("setup_skip_conditions");
  },
  setup_skip_conditions: function (frm) {
    set_skip_logic_conditions(frm);
  },
  engagement_form: function (frm) {
    // let conds =
    //   frm.doc.engagement_form === INITIAL_FORM ? INITIAL_CONDITIONS : "";
    // reset_conditions(frm);
    // frappe.model.set_value(
    //   frm.doc.doctype,
    //   frm.doc.name,
    //   "conditions_plain",
    //   conds,
    // );
    // set_skip_logic_conditions(frm);
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
        link_filters,
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
    //label: df.fieldname + " (" + __(df.label, null, df.parent) + ")",
    label: df.label + " (" + __(df.fieldname, null, df.parent) + ")",
  };
}

function make_recipient_fields(frm, fields) {
  let receiver_fields = [];
  if (frm.doc.channel === "Email" || frm.doc.via_email) {
    receiver_fields = $.map(fields || [], function (d) {
      // Add User and Email fields from child into select dropdown
      if (frappe.model.table_fields.includes(d.fieldtype)) {
        let child_fields = frappe.get_doc("DocType", d.options).fields;
        return $.map(child_fields || [], function (df) {
          return df.options == "Email" ||
            (df.options == "User" && df.fieldtype == "Link")
            ? get_select_options(df, d.fieldname)
            : null;
        });
        // Add User and Email fields from parent into select dropdown
      } else {
        return d.options == "Email" ||
          d.fieldtype == "Read Only" ||
          (d.options == "User" && d.fieldtype == "Link")
          ? get_select_options(d)
          : null;
      }
    });
  } else if (
    ["WhatsApp", "SMS"].includes(frm.doc.channel) ||
    frm.doc.via_sms ||
    frm.doc.via_whatsapp
  ) {
    receiver_fields = $.map(fields || [], function (d) {
      return d.options == "Phone" || d.fieldtype == "Read Only"
        ? get_select_options(d)
        : null;
    });
  }

  // set email recipient options
  frm.fields_dict.recipients.grid.update_docfield_property(
    "receiver_by_document_field",
    "options",
    // [""].concat(["owner"]).concat(receiver_fields)
    [""].concat(receiver_fields),
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

function make_field_display_value(df) {
  return __(df.label) + " (" + df.fieldname + " - " + df.fieldtype + ")";
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

function reset_conditions(frm) {
  let parent = frm.get_field("conditions_loading").$wrapper;
  parent.empty();
  frappe.model.set_value(frm.doctype, frm.docname, "conditions_plain", "");
}

function set_skip_logic_conditions(frm) {
  let cdt = frm.doc.doctype;
  let cdn = frm.doc.name;

  function _set_conditions(filters_field_name, filters_loading_field_name) {
    function _set_form_filter_values() {
      let filters = filter_group.get_filters();
      // each filter returns an list of arrays where each 5th item in the array says if the field is hidden or not.
      // We need to remove the value of hidden property as they are not important in the backend context
      filters = (filters || []).map((el) => {
        return el.length == 5 ? el.slice(0, 4) : el;
      });

      frappe.model.set_value(
        cdt,
        cdn,
        filters_field_name,
        JSON.stringify(filters),
      );
    }
    // let dialog = frm.fields_dict.form_fields.grid.open_grid_row;
    // if (!dialog) return;
    let parent = frm.get_field(filters_loading_field_name).$wrapper;
    parent.empty();

    // let conds_field = frm.get_field(filters_field_name).$wrapper;
    // conds_field.text("");

    let filter_group = new frappe.ui.FilterGroup({
      parent: parent,
      doctype: frm.doc.engagement_form, // frm.doc.doctype, // frm.doc.name,
      on_change: () => {
        setTimeout(() => {
          // Call this after a delay to ensure values reflect correctly
          _set_form_filter_values();
        }, 500);
      },
    });

    const existing_filters = generate_filter_from_json(
      frm,
      frm.doc.doctype,
      frm.doc.name,
      filters_field_name,
    );
    if (existing_filters) {
      if (existing_filters) {
        filter_group.add_filters_to_filter_group(existing_filters);
      }

      frappe.model.set_value(
        cdt,
        cdn,
        filters_field_name,
        JSON.stringify(existing_filters),
      );
    }
  }

  // _create_filter_area();
  if (frm.doc.engagement_form) {
    frappe.model.with_doctype(frm.doc.engagement_form, () => {
      _set_conditions("conditions_plain", "conditions_loading");
      // _set_conditions(
      //   "mandatory_depends_on_plain",
      //   "mandatory_field_filters_loading",
      // );
      // _set_conditions(
      //   "read_only_depends_on_plain",
      //   "readonly_field_filters_loading",
      // );
    });
  }
}

function generate_filter_from_json(frm, dt, dn, filters_field_name) {
  let filters = [];
  if (!frm.doc.__islocal && frm.doc.name) {
    let child = locals[dt][dn];
    filters = frappe.utils.get_filter_from_json(
      child[filters_field_name],
      frm.doc.doctype, //frm.doc.form_name
    );
  }
  return filters;
}
