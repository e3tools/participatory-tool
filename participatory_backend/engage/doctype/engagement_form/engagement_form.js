// Copyright (c) 2024, Steve Nyaga and contributors
// For license information, please see license.txt

const ALLOWED_TITLE_FIELD_TYPES = [
  "Data",
  "Date",
  "Datetime",
  "Link",
  "Linked Field",
  "Select",
];

// frappe.ui.ValidationGroup = class ValidationsDialog extends WidgetDialog {
//   constructor(opts) {
//     super(opts);
//   }

//   get_fields() {
//     return [
//       {
//         fieldtype: "Link",
//         fieldname: "custom_block_name",
//         label: "Custom Block Name",
//         options: "Custom HTML Block",
//         reqd: 1,
//         get_query: () => {
//           return {
//             query:
//               "frappe.desk.doctype.custom_html_block.custom_html_block.get_custom_blocks_for_user",
//           };
//         },
//       },
//     ];
//   }
// };

frappe.ui.ValidationGroup = class extends frappe.ui.FilterGroup {
  constructor(opts) {
    super(opts);
    this.hide_fields_column(opts);
  }
  hide_fields_column(opts) {
    let wrapper = opts.parent;
    let res = wrapper.find(".awesomplete");
  }
  add_error_message_column() {}
  reorder_columns() {}
  on_change() {}
};

frappe.ui.Validation = class extends frappe.ui.Filter {
  constructor(opts) {
    super(opts);
  }
};

frappe.ui.form.on("Engagement Form", {
  setup(frm) {
    frm.set_query("field_child_doctype", "form_fields", function () {
      return {
        filters: {
          istable: 1,
          //'custom': 1,
          //'module': 'Engage'
        },
      };
    });

    frm.set_query("field_doctype", "form_fields", function () {
      return {
        filters: {
          istable: 0,
          //'custom': 1,
          //'module': 'Engage'
        },
      };
    });
  },
  refresh(frm) {
    if (!frm.is_new() && !frm.doc.field_is_table) {
      // force all forms to have web-form enabled
      // frappe.model.set_value(
      //   frm.doc.doctype,
      //   frm.doc.name,
      //   "enable_web_form",
      //   1
      // );
      if (frm.doc.issingle) {
        frm.add_custom_button(__("Go to {0}", [__(frm.doc.name)]), () => {
          window.open(`/app/${frappe.router.slug(frm.doc.name)}`);
        });
      } else {
        // frm.add_custom_button(__("Go to {0} List", [__(frm.doc.name)]), () => {
        // 	window.open(`/app/${frappe.router.slug(frm.doc.name)}`);
        // });
        if (!frm.doc.user_cannot_create) {
          frm.add_custom_button(
            __("New", [__(frm.doc.name)]),
            () => {
              window.open(`/app/${frappe.router.slug(frm.doc.name)}/new`);
            },
            __("View"),
          );
        }
        frm.add_custom_button(
          __("List", [__(frm.doc.name)]),
          () => {
            window.open(`/app/${frappe.router.slug(frm.doc.name)}`);
          },
          __("View"),
        );

        frm.add_custom_button(
          __("Dashboard"),
          () => {
            window.open(
              `/app/${frappe.router.slug(frm.doc.name)}/view/dashboard`,
            );
          },
          __("View"),
        );

        frm.add_custom_button(
          __("Report", [__(frm.doc.name)]),
          () => {
            window.open(`/app/${frappe.router.slug(frm.doc.name)}/view/report`);
          },
          __("View"),
        );
      }
    }
    if (!frm.is_new()) {
    }
    frm.trigger("enable_web_form");
    frm.trigger("set_public_url");
    // if(!frm.is_new() && frm.doc.enable_web_form && !frm.doc.field_is_table) {
    // 	frm.add_custom_button(__("See on website", [__(frm.doc.name)]), () => {
    // 		window.open(`/${frm.doc.route}`);
    // 	}, null);
    // }
    frm.set_query(
      "linked_form_property",
      "form_fields",
      function (frm, cdt, cdn) {
        let child = locals[cdt][cdn];
        let parent = null;
        frm.form_fields?.forEach((field) => {
          if (field.field_name == child.linked_form) {
            parent = field.field_doctype;
          }
        });
        return {
          fields: ["fieldname"],
          filters: [
            ["parenttype", "=", "DocType"], // Adjust the filter criteria as needed
            ["parent", "=", parent],
          ],
        };
      },
    );
    frm.events.show_qrcode(frm);
  },
  onload_post_render(frm) {
    set_title_field_options(frm);
    set_name_field_options(frm);
    set_name_fields_in_grid(frm);
    frm.events.show_qrcode(frm);
  },
  enable_web_form(frm) {
    if (!frm.is_new() && !frm.doc.field_is_table) {
      if (frm.doc.enable_web_form && !frm.doc.user_cannot_create) {
        frm.add_custom_button(
          __("Public View", [__(frm.doc.name)]),
          () => {
            window.open(`/${frappe.router.slug(frm.doc.route)}/new`);
          },
          __("Actions"),
        );
      } else {
        frm.remove_custom_button(__("Public View"), __("Actions"));
      }

      if (!frm.doc.user_cannot_create) {
        frm.add_custom_button(
          __("Create engagement", [__(frm.doc.name)]),
          () => {
            frm.events.make_engagement(frm);
          },
          __("Actions"),
        );
      }
    }
  },
  set_public_url(frm) {
    // if(frm.doc.enable_web_form){
    // 	frappe.model.set_value(frm.doc.doctype, frm.doc.name, 'public_url', `/${frappe.router.slug(frm.doc.route)}/new`);
    // }
  },
  validate: function (frm) {},
  form_fields_add: function (frm) {
    set_title_field_options(frm);
    set_name_field_options(frm);
    set_name_fields_in_grid(frm);
  },
  form_fields_remove: function (frm) {
    set_title_field_options(frm);
    set_name_field_options(frm);
    set_name_fields_in_grid(frm);
  },
  // show_title_field_in_link(frm) {
  // 	set_title_field_options(frm);
  // }
  make_engagement(frm) {
    frappe.call({
      method:
        "participatory_backend.engage.doctype.engagement_form.engagement_form.make_engagement",
      args: {
        form_name: frm.doc.name,
        description: frm.doc.description || frm.doc.name,
      },
      callback: (r) => {
        if (r.message) {
          var doc = frappe.model.sync(r.message);
          frappe.set_route("Form", doc[0].doctype, doc[0].name);
        }
      },
    });
  },
  show_qrcode(frm) {
    let template = '<img src="" />';
    if (!frm.doc.__islocal && !frm.doc.field_is_table && frm.doc.qr_code) {
      template = `<img src="${frm.doc.qr_code}" width="240px"/>`;
    }
    frm.set_df_property(
      "qr_code_preview",
      "options",
      frappe.render_template(template),
    );
    frm.refresh_field("qr_code_preview");
  },
});

frappe.ui.form.on("Engagement Form Field", {
  form_render: function (frm, cdt, cdn) {
    frm.trigger("field_type", cdt, cdn);
    const fld = frm.cur_grid.get_field("set_depends_on");
    if (fld && fld.$input) {
      fld.$input.addClass("btn btn-link");
    }
    if (!frm.doc.__islocal) {
      frm.trigger("setup_skip_conditions", cdt, cdn);
      frm.trigger("setup_validations", cdt, cdn);
      frm.trigger("setup_link_field_filters", cdt, cdn);
    }
    // frm.trigger("make_additional_child_table_fields", cdt, cdn);
    // frm.cur_grid
    //   .get_field("set_depends_on")
    //   .$wrapper.addClass("btn btn-outline-secondary");

    let row = locals[cdt][cdn];
    let wrapper = frm.cur_grid.get_field("formula_builder_html").wrapper;

    $(wrapper).empty();

    // let wrapper = frm.fields_dict['formula_builder_html'].wrapper;
    //     $(wrapper).empty();

    // Render clean markup with zero encoded parameter clutter
    $(wrapper).html(`
            <style>
                .formula-canvas {
                    background: #f8f9fa;
                    border: 2px dashed #cbd5e1 !important;
                    transition: all 0.2s ease-in-out;
                }
                .formula-canvas:hover {
                    border-color: #94a3b8 !important;
                }
                .formula-chip {
                    display: inline-flex;
                    align-items: center;
                    padding: 6px 12px;
                    border-radius: 50rem;
                    font-size: 0.85rem;
                    font-weight: 500;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                    transition: transform 0.1s ease;
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                }
                .formula-chip:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 3px 6px rgba(0,0,0,0.08);
                }
                .chip-field { /*border-left: 4px solid #3b82f6;*/ color: #1e40af; }
                .chip-operator { /*border-left: 4px solid #f59e0b;*/ color: #b45309; font-weight: bold; }
                .chip-number { border-left: 4px solid #10b981; color: #047857; }
                .chip-delete {
                    margin-left: 8px;
                    color: #94a3b8;
                    cursor: pointer;
                    transition: color 0.15s;
                }
                .chip-delete:hover {
                    color: #ef4444;
                }
            </style>

            <div class="formula-builder-wrapper p-3 border rounded bg-white shadow-sm" 
                 x-data="formulaBuilder('${cdt}', '${cdn}')">
                 
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <label class="control-label font-weight-bold text-dark m-0">Visual Formula Builder</label>
                    <button type="button" class="btn btn-xs btn-outline-danger" @click="clearTokens()" x-show="tokens.length > 0">
                        <i class="fa fa-trash mr-1"></i> Clear Formula
                    </button>
                </div>
                
                <!-- 1. Selection Toolbars -->
                <div class="mb-3 p-3 bg-light rounded border">
                    <span class="text-muted text-uppercase font-xs font-weight-bold d-block mb-1">Available Fields</span>
                    <div class="d-flex flex-wrap gap-1 mb-3">
                        <template x-for="field in fields" :key="field">
                            <button type="button" class="btn btn-xs btn-outline-primary mb-1 mr-1" @click="addToken('field', field)">
                                <i class="fa fa-database mr-1"></i><span x-text="field"></span>
                            </button>
                        </template>
                    </div>

                    <span class="text-muted text-uppercase font-xs font-weight-bold d-block mb-1">Operators & Values</span>
                    <div class="d-flex flex-wrap gap-1 align-items-center">
                        <template x-for="op in operators" :key="op">
                            <button type="button" class="btn btn-xs btn-secondary font-weight-bold mb-1 mr-1 px-2" @click="addToken('operator', op)" x-text="op"></button>
                        </template>
                        <button type="button" class="btn btn-xs btn-info mb-1 mr-1" @click="addNumberPrompt()">
                            <i class="fa fa-hashtag mr-1"></i> Add Number
                        </button>
                        <button type="button" class="btn btn-xs btn-info mb-1 mr-1" @click="addTextPrompt()">
                            <i class="fa fa-file-text mr-1"></i> Add Text
                        </button>
                    </div>
                </div>

                <!-- 2. Polished Expression Canvas -->
                <div class="formula-canvas p-3 rounded d-flex flex-wrap align-items-center gap-2 mb-3" style="min-height: 70px;">
                    <template x-if="tokens.length === 0">
                        <span class="text-muted font-italic text-sm">
                            <i class="fa fa-info-circle mr-1"></i> Click fields, operators, or numbers above to construct your expression...
                        </span>
                    </template>
                    <template x-for="(token, index) in tokens" :key="index">
                        <div class="formula-chip mr-2 mb-2"
                             :class="{
                                 'chip-field': token.type === 'field',
                                 'chip-operator': token.type === 'operator',
                                 'chip-number': token.type === 'number'
                             }">
                            <i class="mr-1 text-xs" :class="{
                                'fa fa-database': token.type === 'field',
                                'fa fa-calculator': token.type === 'operator',
                                'fa fa-hashtag': token.type === 'number'
                            }"></i>
                            <span x-text="token.value"></span>
                            <i class="fa fa-times-circle chip-delete" @click="removeToken(index)" title="Remove"></i>
                        </div>
                    </template>
                </div>

                <!-- 3. Live Preview & Status Bar -->
                <div class="d-flex justify-content-between align-items-center bg-light p-2 rounded border">
                    <span class="text-xs text-muted font-weight-bold">Compiled: <code class="text-dark bg-white px-2 py-1 border rounded ml-1" x-text="compiledExpression || '(empty)'"></code></span>
                    <button type="button" class="btn btn-xs btn-primary px-3" @click="testEvaluation()">
                        <i class="fa fa-play mr-1"></i> Test Formula
                    </button>
                </div>
                
                <div class="mt-2" x-show="previewResult !== null" x-transition>
                    <div class="alert mb-0 py-2 px-3 text-xs" :class="previewError ? 'alert-danger' : 'alert-success'" x-text="previewResult"></div>
                </div>
            </div>
        `);
    // Ensure Alpine loads and initializes the wrapper DOM node securely
    load_alpine(() => {
      register_formula_builder_component(frm);
      if (window.Alpine && typeof window.Alpine.initTree === "function") {
        window.Alpine.initTree(wrapper);
      }
    });

    // // Get sibling fields from the parent form or other child fields for referencing
    // let available_fields = frm.doc.form_fields || [];

    // available_fields = available_fields
    //   .filter((f) =>
    //     ["Float", "Int", "Currency", "Percent"].includes(f.field_type),
    //   )
    //   .map((f) => f.field_name);

    // if (available_fields.length === 0) {
    //   available_fields = ["qty", "rate", "amount", "unit_price"];
    // }
    // debugger;
    // // Render the Alpine.js component template
    // $(wrapper).html(get_alpine_template(cdt, cdn, row, available_fields));

    // // Initialize Alpine component if not already globally active
    // //if (window.Alpine) {
    // if (window.Alpine && typeof window.Alpine.initTree === "function") {
    //   debugger;
    //   window.Alpine.initTree(wrapper);
    // }
  },
  field_type: function (frm, cdt, cdn) {
    var child = locals[cdt][cdn];
    if (child.field_type == "Linked Field") {
      let link_fields = [];
      let val = child[child.field_name];
      frm.doc.form_fields?.forEach((field) => {
        if (field.field_type == "Link") {
          link_fields.push({
            label: `${field.field_label} - ${field.field_doctype}`,
            value: field.field_name,
            selected: field.field_name === val,
          });
        }
      });
      frm.set_df_property(
        "form_fields",
        "options",
        link_fields,
        frm.doc.name,
        "linked_form",
        cdn,
      );
      frm.trigger("linked_form", cdt, cdn);
    }
    frm.trigger("layout_fields", cdt, cdn);
  },
  linked_form: function (frm, cdt, cdn) {
    var child = locals[cdt][cdn];
    frappe.model.set_value(cdt, cdn, "linked_form", child.linked_form);
    if (child.linked_form) {
      const doctype = get_linked_form_doctype(frm, child.linked_form);
      frappe.call({
        method:
          "participatory_backend.engage.doctype.engagement_form.engagement_form.get_docfields",
        args: {
          doctype: doctype,
        },
        freeze: true,
        callback: function (r) {
          let fields = [];
          if (r.message) {
            r.message.forEach((el) => {
              fields.push({ label: el.label, value: el.fieldname });
            });
            frm.set_df_property(
              "form_fields",
              "options",
              fields,
              frm.doc.name,
              "linked_form_property",
              cdn,
            );

            frm.trigger("set_linked_field_value", cdt, cdn);
          }
        },
      });
    }
  },
  linked_form_property: function (frm, cdt, cdn) {
    var child = locals[cdt][cdn];
    frappe.model.set_value(
      cdt,
      cdn,
      "linked_form_property",
      child.linked_form_property,
    );
    frm.trigger("set_linked_field_value", cdt, cdn);
  },
  layout_fields: function (frm, cdt, cdn) {
    const props = [
      ["field_reqd", false],
      ["field_readonly", false],
      ["field_hidden", false],
      ["field_is_backend_field", false],
      ["field_default", ""],
      ["field_in_list_view", false],
      ["field_is_search_field", false],
      //["set_mandatory_depends_on", null],
      //["mandatory_depends_on_plain", ""], //set to null to avoid overriding incase user selected another field type
      //["mandatory_depends_on", ""], //set to null to avoid overriding incase user selected another field type
      //["set_read_only_depends_on", null], //set to null to avoid overriding incase user selected another field type
      //["read_only_depends_on_plain", null], //set to null to avoid overriding incase user selected another field type
      //["read_only_depends_on", ""],
      ["description", ""],
      ["max_height", ""],
    ];
    var child = locals[cdt][cdn];
    var is_layout_field = in_list(
      ["Section Break", "Column Break"],
      child.field_type,
    );
    props.forEach((el) => {
      frm.set_df_property(
        "form_fields",
        "hidden",
        is_layout_field,
        frm.doc.name,
        el[0],
        cdn,
      );

      // if (el[1] !== null) {
      //   frappe.model.set_value(cdt, cdn, el[0], el[1]);
      // }
    });
  },
  set_linked_field_value: function (frm, cdt, cdn) {
    let child = locals[cdt][cdn];
    let parent = child.linked_form;
    let property = child.linked_form_property;
    let val = "";
    if (parent && property) {
      val = `${parent}.${property}`;
    }
    frappe.model.set_value(cdt, cdn, "field_linked_field", val);
  },
  set_filters: function (frm, cdt, cdn) {
    let child = locals[cdt][cdn];
    if (!child.field_doctype) {
      frappe.throw("You must select the Form first");
    }
    edit_filters(
      frm,
      child.field_doctype,
      child.field_filters_plain || "{}",
      (filters) => {
        frappe.model.set_value(
          child.doctype,
          child.name,
          "field_filters_plain",
          filters,
        );
      },
    );
  },
  set_depends_on: function (frm, cdt, cdn) {
    let child = locals[cdt][cdn];
    edit_filters(
      frm,
      child.parent,
      child.depends_on_plain || "{}",
      (filters) => {
        frappe.model.set_value(
          child.doctype,
          child.name,
          "depends_on_plain",
          filters,
        );
      },
    );
  },
  set_mandatory_depends_on: function (frm, cdt, cdn) {
    let child = locals[cdt][cdn];
    edit_filters(
      frm,
      child.parent,
      child.mandatory_depends_on_plain || "{}",
      (filters) => {
        frappe.model.set_value(
          child.doctype,
          child.name,
          "mandatory_depends_on_plain",
          filters,
        );
      },
    );
  },
  set_read_only_depends_on: function (frm, cdt, cdn) {
    let child = locals[cdt][cdn];
    edit_filters(
      frm,
      child.parent,
      child.read_only_depends_on_plain || "{}",
      (filters) => {
        frappe.model.set_value(
          child.doctype,
          child.name,
          "read_only_depends_on_plain",
          filters,
        );
      },
    );
  },
  make_additional_child_table_fields: function (frm, cdt, cdn) {
    // see https://discuss.frappe.io/t/is-there-any-way-i-can-add-child-table-inside-a-child-table/116188/12
    let child_row = locals[cdt][cdn];
    let dialog = frm.fields_dict.form_fields.grid.open_grid_row;

    if (!dialog) return;

    let wrapper = dialog.fields_dict.additional_linked_table_fields.wrapper;
    wrapper.replaceChildren();

    let field_group = new frappe.ui.FieldGroup({
      fields: [
        {
          fieldtype: "HTML",
          fieldname: "grandchild_table",
          in_place_edit: true,
          options:
            "Additional fields to add to a linked table field. Set this only when the value of <strong>Field in the Linked Form</strong> field is of type Table",
        },
        {
          fieldtype: "Table",
          fieldname: "grandchild_table",
          in_place_edit: true,
          data: JSON.parse(child_row.additional_linked_table_fields || "[]"),
          fields: [
            {
              fieldname: "label",
              label: "Label",
              fieldtype: "Data",
              in_list_view: 1,
              reqd: 1,
              columns: 2,
            },
            {
              fieldname: "fieldname",
              label: "Field ID",
              fieldtype: "Data",
              in_list_view: 1,
              reqd: 0,
              columns: 2,
            },
            {
              fieldname: "fieldtype",
              label: "Type",
              fieldtype: "Select",
              options: [
                "Attach",
                "Attach Image",
                "Check",
                "Currency",
                "Data",
                "Date",
                "Datetime",
                "Int",
                "Float",
                "Geolocation",
                "Link",
                "Select",
                "Text",
                "Text Editor",
                "Time",
              ],
              in_list_view: 1,
              reqd: 1,
              columns: 2,
            },
            {
              fieldname: "reqd",
              label: "Required",
              fieldtype: "Check",
              in_list_view: 1,
              reqd: 0,
              columns: 2,
            },
            {
              fieldname: "options",
              label: "Options",
              fieldtype: "Small Text",
              in_list_view: 1,
              columns: 2,
            },
          ],
          get_data: () => field_group.get_value("grandchild_table"),
        },
      ],
      body: wrapper,
    });

    field_group.make();

    // Update the JSON field whenever the table changes
    field_group.fields_dict.grandchild_table.grid.wrapper.on("change", () => {
      child_row.additional_linked_table_fields = JSON.stringify(
        field_group.get_value("grandchild_table"),
      );
      frm.dirty();
    });
  },
  setup_skip_conditions: function (frm, cdt, cdn) {
    set_skip_logic_conditions(frm, cdt, cdn);
  },

  setup_link_field_filters: function (frm, cdt, cdn) {
    set_link_field_filters(frm, cdt, cdn);
  },
  setup_validations: function (frm, cdt, cdn) {
    let dialog = frm.fields_dict.form_fields.grid.open_grid_row;
    if (!dialog) return;
    let child = locals[cdt][cdn];
    let filter_group = new engage.ui.ValidationGroup({
      parent: dialog.fields_dict["validations_area"].$wrapper, // this.dialog.get_field("display_filter_area").$wrapper,
      doctype: frm.doc.name, // frm.doc.doctype, // frm.doc.name,
      fieldname: child.field_name,
      on_change: () => {
        let filters = filter_group.get_filters();
        // each filter returns an list of arrays where each 6th item in the array says if the field is hidden or not.
        // We need to remove the value of hidden property as they are not important in the backend context
        filters = (filters || []).map((el) => {
          return el.length == 5 ? el.slice(0, 5) : el;
        });
        frappe.model.set_value(
          cdt,
          cdn,
          "validations",
          JSON.stringify(filters),
        );
        console.log("Validations: ", filters);
      },
      field_to_validate: child.field_name,
    });

    if (frm.doc.form_name) {
      frappe.model.with_doctype(frm.doc.form_name, () => {
        const existing_filters = generate_filter_from_json(
          frm,
          cdt,
          cdn,
          "validations",
        ); // child[filters_field_name];
        if (existing_filters) {
          // let filters = JSON.parse(existing_filters);
          if (existing_filters /*filters*/) {
            filter_group.add_filters_to_filter_group(
              existing_filters /*filters*/,
            );
          }
        }
      });
    }
  },
});

function register_formula_builder_component(frm) {
  if (frm.doc.__islocal) {
    return;
  }
  if (!window.Alpine) return;

  // Register component safely if not already registered
  if (!window.Alpine.data("formulaBuilder")) {
    window.Alpine.data("formulaBuilder", (cdt, cdn) => ({
      cdt: cdt,
      cdn: cdn,
      tokens: [],
      fields: [],
      operators: ["+", "-", "*", "/", "(", ")"],
      previewResult: null,
      previewError: false,

      init() {
        let row = locals[this.cdt][this.cdn] || {};
        let available_fields = frm.doc.form_fields || [];

        this.fields = available_fields
          .filter((f) =>
            ["Float", "Int", "Currency", "Percent", "Data", "Select"].includes(
              f.field_type,
            ),
          )
          .map((f) => f.field_name);

        // let keys = Object.keys(row).filter(
        //   (key) =>
        //     ![
        //       "name",
        //       "owner",
        //       "creation",
        //       "modified",
        //       "modified_by",
        //       "parent",
        //       "parentfield",
        //       "parenttype",
        //       "idx",
        //       "docstatus",
        //       "doctype",
        //       "expression_json",
        //       "formula_builder_html",
        //     ].includes(key),
        // );
        // this.fields =
        //   keys.length > 0
        //     ? keys
        //     : ["qty", "rate", "amount", "unit_price", "score"];

        try {
          this.tokens = row.expression_json
            ? JSON.parse(row.expression_json)
            : [];
        } catch (e) {
          this.tokens = [];
        }
      },

      get compiledExpression() {
        return this.tokens.map((t) => t.value).join(" ");
      },

      addToken(type, value) {
        this.tokens.push({ type, value });
        this.syncToFrappe();
      },

      addNumberPrompt() {
        let val = prompt("Enter number value:");
        if (val !== null && !isNaN(val)) {
          this.tokens.push({ type: "number", value: val });
          this.syncToFrappe();
        }
      },

      addTextPrompt() {
        let val = prompt("Enter text value:");
        if (val !== null) {
          this.tokens.push({ type: "string", value: '"' + val + '"' });
          this.syncToFrappe();
        }
      },

      removeToken(index) {
        this.tokens.splice(index, 1);
        this.syncToFrappe();
      },

      clearTokens() {
        this.tokens = [];
        this.previewResult = null;
        this.syncToFrappe();
      },

      syncToFrappe() {
        frappe.model.set_value(
          this.cdt,
          this.cdn,
          "expression_json",
          JSON.stringify(this.tokens),
        );
      },

      testEvaluation() {
        let row = locals[this.cdt][this.cdn];
        frappe.call({
          method: "participatory_backend.api.evaluate_formula",
          args: {
            formula_tokens: this.tokens,
            row_data: row,
            doctype: frm.doc.form_name, // Pass child DocType name for type validation
            target_field: row.field_name,
          },
          callback: (r) => {
            if (r.message && r.message.status === "success") {
              let formula = null;
              if (r.message.is_dry_run) {
                this.previewResult = `✔ Valid Syntax! (Tested with mock values: ${r.message.result})`;
                formula = r.message.formula;
              } else {
                this.previewResult = `✔ Evaluated Result: ${r.message.result}`;
                formula = r.message.formula;
                frappe.model.set_value(
                  this.cdt,
                  this.cdn,
                  "derived_value",
                  r.message.result,
                );
              }
              this.previewError = false;

              frappe.model.set_value(this.cdt, this.cdn, "formula", formula);
            } else {
              this.previewResult = `✖ ${r.message.message}`;
              this.previewError = true;
            }
            /*
            if (r.message && r.message.status === "success") {
              this.previewResult = `Evaluated Result: ${r.message.result}`;
              this.previewError = false;
              frappe.model.set_value(
                this.cdt,
                this.cdn,
                "derived_value",
                r.message.result,
              );
            } else {
              this.previewResult = `Error: ${r.message.message}`;
              this.previewError = true;
            }*/
          },
        });
      },
    }));
  }
}

function get_alpine_template(cdt, cdn, row, available_fields) {
  let initial_tokens = [];
  try {
    initial_tokens = row.expression_json ? JSON.parse(row.expression_json) : [];
  } catch (e) {
    initial_tokens = [];
  }

  let encoded_tokens = encodeURIComponent(JSON.stringify(initial_tokens));
  let encoded_fields = encodeURIComponent(JSON.stringify(available_fields));

  return `
        <div class="formula-builder-wrapper p-3 border rounded bg-light" 
             x-data="formulaBuilder('${cdt}', '${cdn}', '${encoded_tokens}', '${encoded_fields}')">
             
            <label class="control-label font-weight-bold mb-2 text-dark">Visual Formula Builder</label>
            
            <!-- 1. Selection Toolbars -->
            <div class="mb-3">
                <span class="text-muted d-block mb-1 font-xs">Available Fields:</span>
                <div class="d-flex flex-wrap gap-1 mb-2">
                    <template x-for="field in fields" :key="field">
                        <button type="button" class="btn btn-xs btn-outline-primary mb-1 mr-1" @click="addToken('field', field)" x-text="field"></button>
                    </template>
                </div>

                <span class="text-muted d-block mb-1 font-xs">Operators & Numbers:</span>
                <div class="d-flex flex-wrap gap-1 align-items-center">
                    <template x-for="op in operators" :key="op">
                        <button type="button" class="btn btn-xs btn-outline-secondary font-weight-bold mb-1 mr-1" @click="addToken('operator', op)" x-text="op"></button>
                    </template>
                    <button type="button" class="btn btn-xs btn-outline-success mb-1 mr-1" @click="addNumberPrompt()">+ Number</button>
                    <button type="button" class="btn btn-xs btn-danger mb-1 ml-auto" @click="clearTokens()">Clear</button>
                </div>
            </div>

            <!-- 2. Expression Canvas -->
            <div class="expression-canvas p-2 bg-white border rounded d-flex flex-wrap align-items-center gap-1 min-h-40px mb-3" style="min-height: 50px;">
                <template x-if="tokens.length === 0">
                    <span class="text-muted font-italic font-xs">Click fields and operators above to build your formula...</span>
                </template>
                <template x-for="(token, index) in tokens" :key="index">
                    <div class="badge badge-pill d-flex align-items-center p-2 mr-1 mb-1"
                         :class="token.type === 'field' ? 'badge-primary' : (token.type === 'operator' ? 'badge-secondary' : 'badge-success')">
                        <span x-text="token.value" class="mr-1"></span>
                        <i class="fa fa-times-circle text-white cursor-pointer" @click="removeToken(index)"></i>
                    </div>
                </template>
            </div>

            <!-- 3. Live Preview & Status Bar -->
            <div class="d-flex justify-content-between align-items-center">
                <span class="text-xs text-muted">Expression: <code x-text="compiledExpression"></code></span>
                <button type="button" class="btn btn-xs btn-info" @click="testEvaluation()">Test Formula</button>
            </div>
            
            <div class="mt-2" x-show="previewResult !== null">
                <span class="badge" :class="previewError ? 'badge-danger' : 'badge-success'" x-text="previewResult"></span>
            </div>
        </div>
    `;
}

function load_alpine(callback) {
  if (window.Alpine) {
    callback();
    return;
  }
  if (!document.getElementById("alpine-cdn")) {
    let script = document.createElement("script");
    script.id = "alpine-cdn";
    script.src = "https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js";
    script.defer = true;
    document.head.appendChild(script);
  }
  let checkInterval = setInterval(() => {
    if (window.Alpine) {
      clearInterval(checkInterval);
      callback();
    }
  }, 50);
}

function set_skip_logic_conditions(frm, cdt, cdn) {
  function _set_conditions(filters_field_name, filters_loading_field_name) {
    let dialog = frm.fields_dict.form_fields.grid.open_grid_row;
    if (!dialog) return;

    let filter_group = new frappe.ui.FilterGroup({
      parent: dialog.fields_dict[filters_loading_field_name].$wrapper, // this.dialog.get_field("display_filter_area").$wrapper,
      doctype: frm.doc.name, // frm.doc.doctype, // frm.doc.name,
      on_change: () => {
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
        console.log("Filters: ", filters);
      },
    });
    let child = locals[cdt][cdn];
    const existing_filters = generate_filter_from_json(
      frm,
      cdt,
      cdn,
      filters_field_name,
    ); // child[filters_field_name];
    if (existing_filters) {
      // let filters = JSON.parse(existing_filters);
      if (existing_filters /*filters*/) {
        filter_group.add_filters_to_filter_group(existing_filters /*filters*/);
      }
    }
  }

  if (frm.doc.form_name) {
    // _create_filter_area();
    frappe.model.with_doctype(frm.doc.form_name, () => {
      _set_conditions("depends_on_plain", "display_field_filters_loading");
      _set_conditions(
        "mandatory_depends_on_plain",
        "mandatory_field_filters_loading",
      );
      _set_conditions(
        "read_only_depends_on_plain",
        "readonly_field_filters_loading",
      );
    });
  }
}

function set_link_field_filters(frm, cdt, cdn) {
  let child = locals[cdt][cdn];

  function _set_filters(filters_field_name, filters_loading_field_name) {
    let dialog = frm.fields_dict.form_fields.grid.open_grid_row;
    if (!dialog) return;

    let filter_group = new frappe.ui.FilterGroup({
      parent: dialog.fields_dict[filters_loading_field_name].$wrapper, // this.dialog.get_field("display_filter_area").$wrapper,
      doctype: child.field_doctype, // use the doctype of the link field
      on_change: () => {
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
        console.log("Link Filters: ", filters);
      },
    });
    const existing_filters = generate_filter_from_json(
      frm,
      cdt,
      cdn,
      filters_field_name,
    ); // child[filters_field_name];
    if (existing_filters) {
      // let filters = JSON.parse(existing_filters);
      if (existing_filters /*filters*/) {
        filter_group.add_filters_to_filter_group(existing_filters /*filters*/);
      }
    }
  }

  if (child.field_doctype) {
    frappe.model.with_doctype(child.field_doctype, () => {
      _set_filters("field_filters_plain", "link_filters_area");
    });
  }
}

function generate_filter_from_json(frm, cdt, cdn, filters_field_name) {
  let filters = [];
  if (!frm.doc.__islocal && frm.doc.form_name && frm.doc.form_fields) {
    let child = locals[cdt][cdn];
    filters = frappe.utils.get_filter_from_json(
      child[filters_field_name],
      frm.doc.doctype, //frm.doc.form_name
    );
  }
  return filters;
}

function edit_filters(frm, doctype, existing_filters, on_add_filter) {
  let field_doctype = doctype;
  //   const { frm } = store;
  make_filters_dialog(frm, on_add_filter);

  make_filters_area(frm, field_doctype);

  if (field_doctype) {
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
}

function edit_filters_link(frm, child) {
  let field_doctype = child.field_doctype;
  //   const { frm } = store;
  make_filters_dialog(frm, child);
  make_filters_area(frm, field_doctype);

  if (field_doctype) {
    frappe.model.with_doctype(field_doctype, () => {
      frm.dialog.show();
      add_existing_filter(frm, child);
    });
  }
}

const set_title_field_options = function (frm) {
  const val = frm.doc.title_field;
  let label_val = "";
  const fields = [];
  frm.doc.form_fields?.forEach((field) => {
    if (ALLOWED_TITLE_FIELD_TYPES.includes(field.field_type)) {
      fields.push({
        label: field.field_label,
        value: field.field_label,
        selected: field.field_name === val,
      });
    }
    if (field.field_name === val) {
      label_val = field.field_label;
    }
  });
  fields.sort((a, b) =>
    a.label.toUpperCase() < b.label.toUpperCase() ? -1 : 1,
  );
  frm.set_df_property("title_field", "options", fields, frm.doc.name);
  frappe.model.set_value(
    frm.doc.doctype,
    frm.doc.name,
    "title_field",
    label_val,
  );
};

const set_name_field_options = function (frm) {
  const val = frm.doc.naming_field;
  let label_val = "";
  let fields = [];
  frm.doc.form_fields?.forEach((field) => {
    if (ALLOWED_TITLE_FIELD_TYPES.includes(field.field_type)) {
      fields.push({
        label: field.field_label,
        value: field.field_label,
        selected: field.field_name === val,
      });
    }
    if (field.field_name === val) {
      label_val = field.field_label;
    }
  });
  fields.sort((a, b) =>
    a.label.toUpperCase() < b.label.toUpperCase() ? -1 : 1,
  );
  frm.set_df_property("naming_field", "options", fields, frm.doc.name);
  frappe.model.set_value(
    frm.doc.doctype,
    frm.doc.name,
    "naming_field",
    label_val,
  );
};

const set_name_fields_in_grid = function (frm) {
  frappe.call({
    method:
      "participatory_backend.engage.doctype.engagement_form.engagement_form.get_docfields",
    args: {
      doctype: frm.doc.name,
    },
    freeze: true,
    callback: function (r) {
      // initialize an empty array
      let fields = [];
      let link_fields = [];
      if (r.message) {
        r.message.forEach((el) => {
          if (
            !frappe.model.no_value_type.includes(el.fieldtype)
            /*&&
            UPDATEABLE_TYPES.includes(el.fieldtype)*/
          ) {
            fields.push({
              label: make_field_display_value(el),
              value: el.fieldname, // + " (" + __(el.label) + ")",
            });
          }
          // Get a Link form that has the Engagement Form as options
          if (el.fieldtype === "Link" && el.options === frm.doc.related_form) {
            link_fields.push({
              label: __(el.label) + " - " + el.fieldname,
              value: el.fieldname, // + " (" + __(el.label) + ")",
            });
          }
        });
        fields.sort((a, b) =>
          a.label.toUpperCase() < b.label.toUpperCase() ? -1 : 1,
        );
        frm.fields_dict.naming_fields_grid.grid.update_docfield_property(
          "form_field",
          "options",
          fields,
        );
        /*
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
          make_recipient_fields(frm, r.message); // fields);*/
      }
    },
  });

  const val = frm.doc.naming_field;
  let label_val = "";
  let fields = [];
  frm.doc.form_fields?.forEach((field) => {
    if (ALLOWED_TITLE_FIELD_TYPES.includes(field.field_type)) {
      fields.push({
        label: field.field_label,
        value: field.field_label,
        selected: field.field_name === val,
      });
    }
    if (field.field_name === val) {
      label_val = field.field_label;
    }
  });
  fields.sort((a, b) =>
    a.label.toUpperCase() < b.label.toUpperCase() ? -1 : 1,
  );
  frm.set_df_property("naming_field", "options", fields, frm.doc.name);
  frappe.model.set_value(
    frm.doc.doctype,
    frm.doc.name,
    "naming_field",
    label_val,
  );
};

const get_linked_form_doctype = (frm, field_name) => {
  let doctype = null;
  frm.doc.form_fields?.forEach((field) => {
    if (field.field_type == "Link" && field.field_name == field_name) {
      doctype = field.field_doctype;
    }
  });
  return doctype;
};

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

// frappe.ui.form.on("Engagement Form Field", "linked_form", function(frm, cdt, cdn) {
// 	var child = locals[cdt][cdn];
// 	if(child.field_type == 'Linked Field') {
// 		let link_fields = [];
// 		frm.doc.form_fields?.forEach(field => {
// 			if(field.field_type == 'Link'){
// 				link_fields.push({'label': `${field.field_label} - ${field.field_doctype}`, 'value': field.field_name});
// 			}
// 		});
// 		//frm.fields_dict['linked_form'].options=link_fields;
// 		//frm.set_df_property("linked_form", "options", link_fields, frm.doc.name, 'form_fields', cdn);
// 		frm.set_df_property("form_fields", "options", link_fields, frm.doc.name, 'linked_form', cdn);

// 		//set_df_property(fieldname, property, value, docname, table_field, table_row_name = null)
// 		console.log("Link fields: ", link_fields)
// 	}
// 	console.log(child.field_type);
// });

/**
 * Convert filters entry as set by the Filters Dialog into js format i.e the format with eval:doc....
 * @param {*} condition e.g [["Test Form Five","sample_gender","=","Male"]]
 */
const convert_conditions_to_js_format = (conditions) => {
  if (condition.length <= 0) {
    return "";
  }
  let res = "eval:";
  for (var i = 0; i < conditions.length; i++) {
    const condition = conditions[i];
    console.log("Filter: ", condition);
    res += "(" + construct_js_expression(condition) + ")";
    if (i != conditions.length - 1) {
      exp += " && ";
    }
  }
  return res;
};

/**
 * Construct a JS expression given a filter
 * @param {*} condition e.g ["Test Form Five","sample_gender","=","Male"]
 */
const construct_js_expression = (condition) => {
  if (condition.length < 4) {
    // condition has 4 parts
    return "";
  }
  const field = condition[1];
  const operator = condition[2];
  const value = condition[3];
  let exp = "";
  switch (operator) {
    case "=":
      exp = `doc.${field}==${value}`;
      break;
    case "!=":
      exp = `doc.${field}!=${value}`;
      break;
    case "like":
      exp = `doc.${field}.indexOf(${value}) != -1`;
      break;
    case "not like":
      exp = `doc.${field}.indexOf(${value}) == -1`;
      break;
    case "in":
      exp += "";
      for (var i = 0; i < value.length; i++) {
        exp += `doc.${field} == ${value[i]}`;
        if (i != value.length - 1) {
          exp += " || ";
        }
      }
      break;
    case "not in":
      exp += "";
      for (var i = 0; i < value.length; i++) {
        exp += `doc.${field} != ${value[i]}`;
        if (i != value.length - 1) {
          exp += " && ";
        }
      }
      break;
    case "is":
      if (value == "Set") {
        exp = `doc.${field}`;
      } else {
        exp = `!doc.${field}`;
      }
      break;
    case ">":
      exp = `doc.${field}>${value}`;
      break;
    case "<":
      exp = `doc.${field}<${value}`;
      break;
    case ">=":
      exp = `doc.${field}>=${value}`;
      break;
    case "<=":
      exp = `doc.${field}<=${value}`;
      break;
    case "Between":
      exp = `doc.${field}>=${value[0]} && doc.${field}<=${value[1]}`;
      break;
    case "Timespan":
      break;
  }
  return exp;
};

function make_field_display_value(df) {
  // return __(df.label) + " (" + df.fieldname + " - " + df.fieldtype + ")";
  return __(df.label) + " - " + df.fieldtype;
}
