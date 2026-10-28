// frappe.pages["custom-print-designer"].on_page_load = function (wrapper) {
//   var page = frappe.ui.make_app_page({
//     parent: wrapper,
//     title: __("Print Layout Designer"),
//     single_column: true,
//   });

//   // Dynamically load SortableJS library
//   frappe.require(
//     "https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js",
//     function () {
//       new PrintDesigner(page);
//     },
//   );
// };

// class PrintDesigner {
//   constructor(page) {
//     this.page = page;
//     this.selectedDocType = null;
//     this.canvasItems = [];

//     this.render_page_structure();
//     this.setup_events();
//     this.load_doctypes();
//   }

//   render_page_structure() {
//     this.page.main.html(`
//             <style>
//                 .designer-wrapper { display: flex; flex-direction: column; height: calc(100vh - 140px); gap: 15px; padding: 10px; }
//                 .top-toolbar { background: #fff; border: 1px solid #d1d8dd; border-radius: 8px; padding: 15px; display: flex; gap: 20px; align-items: center; justify-content: space-between; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
//                 .toolbar-group { display: flex; gap: 15px; align-items: center; flex: 1; }
//                 .designer-container { display: flex; gap: 20px; flex: 1; overflow: hidden; }
//                 .palette { width: 300px; background: #f8f9fa; border: 1px solid #d1d8dd; border-radius: 8px; padding: 15px; overflow-y: auto; }
//                 .canvas-wrapper { flex: 1; background: #eaeded; border: 1px solid #d1d8dd; border-radius: 8px; padding: 20px; overflow-y: auto; display: flex; justify-content: center; }
//                 .paper-canvas { width: 100%; max-width: 700px; min-height: 700px; background: #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.1); border-radius: 4px; padding: 30px; }
//                 .drag-item { background: #fff; border: 1px solid #d1d8dd; border-radius: 4px; padding: 10px 12px; margin-bottom: 8px; cursor: grab; font-weight: 500; }
//                 .canvas-item { border: 1px dashed #a0aec0; border-radius: 4px; padding: 12px; margin-bottom: 10px; background: #f7fafc; position: relative; }
//                 .canvas-item .remove-btn { position: absolute; right: 8px; top: 8px; color: #e53e3e; cursor: pointer; font-size: 18px; }
//                 .ghost-class { opacity: 0.4; background: #edf2f7; }
//             </style>

//             <div class="designer-wrapper">
//                 <!-- Top Toolbar Controls -->
//                 <div class="top-toolbar">
//                     <div class="toolbar-group">
//                         <div style="flex: 1;">
//                             <label class="text-muted small font-weight-bold mb-1">${__("Select Custom DocType")}</label>
//                             <select id="doctype-select" class="form-control">
//                                 <option value="">${__("-- Select DocType --")}</option>
//                             </select>
//                         </div>
//                         <div style="flex: 1;">
//                             <label class="text-muted small font-weight-bold mb-1">${__("Format Name")}</label>
//                             <input type="text" id="format-name-input" class="form-control" placeholder="e.g. Custom Invoice Layout">
//                         </div>
//                     </div>
//                     <div>
//                         <button id="save-format-btn" class="btn btn-primary btn-sm px-4 py-2">${__("Save Print Format")}</button>
//                     </div>
//                 </div>

//                 <!-- Main Designer Canvas & Sidebar Area -->
//                 <div class="designer-container">
//                     <div class="palette">
//                         <h6 class="text-muted uppercase font-weight-bold mb-3">${__("Elements")}</h6>
//                         <div id="static-elements">
//                             <div class="drag-item" data-type="heading">${__("Title / Heading")}</div>
//                             <div class="drag-item" data-type="spacer">${__("Spacer Block")}</div>
//                         </div>

//                         <h6 class="text-muted uppercase font-weight-bold my-3">${__("DocType Fields")}</h6>
//                         <div id="field-elements">
//                             <p class="text-muted small">${__("Select a DocType above to load fields")}</p>
//                         </div>
//                     </div>

//                     <div class="canvas-wrapper">
//                         <div class="paper-canvas" id="canvas">
//                             <p class="text-muted text-center mt-5" id="canvas-placeholder">${__("Drag elements here from the left sidebar")}</p>
//                         </div>
//                     </div>
//                 </div>
//             </div>
//         `);
//   }

//   setup_events() {
//     let me = this;

//     // DocType change listener
//     $("#doctype-select").on("change", function () {
//       me.selectedDocType = $(this).val();
//       me.load_doctype_fields();
//     });

//     // Save button listener
//     $("#save-format-btn").on("click", function () {
//       me.save_layout();
//     });

//     this.init_drag_drop();
//   }

//   load_doctypes() {
//     // Fetch custom doctypes (or all doctypes if custom filter isn't strict)
//     frappe.call({
//       method: "frappe.client.get_list",
//       args: {
//         doctype: "DocType",
//         filters: { module: "Engage", custom: 1, istable: 0 },
//         fields: ["name"],
//         order_by: "name asc",
//       },
//       callback: (r) => {
//         if (r.message) {
//           let select = $("#doctype-select");
//           r.message.forEach((d) => {
//             select.append(`<option value="${d.name}">${d.name}</option>`);
//           });
//         }
//       },
//     });
//   }

//   load_doctype_fields() {
//     let fieldsContainer = $("#field-elements");
//     fieldsContainer.empty();

//     if (!this.selectedDocType) {
//       fieldsContainer.html(
//         `<p class="text-muted small">${__("Select a DocType to load fields")}</p>`,
//       );
//       return;
//     }

//     frappe.model.with_doctype(this.selectedDocType, () => {
//       let meta = frappe.get_meta(this.selectedDocType);

//       meta.fields.forEach((f) => {
//         if (
//           !["Section Break", "Column Break", "HTML", "Button"].includes(
//             f.fieldtype,
//           )
//         ) {
//           fieldsContainer.append(`
//                         <div class="drag-item" data-type="${f.fieldtype === "Table" ? "table" : "field"}" data-fieldname="${f.fieldname}" data-label="${f.label}">
//                             ${f.label} <span class="badge badge-light text-muted float-right">${f.fieldtype}</span>
//                         </div>
//                     `);
//         }
//       });
//     });
//   }

//   init_drag_drop() {
//     let me = this;
//     let canvasEl = document.getElementById("canvas");

//     new Sortable(document.getElementById("static-elements"), {
//       group: { name: "shared", pull: "clone", put: false },
//       sort: false,
//     });

//     new Sortable(document.getElementById("field-elements"), {
//       group: { name: "shared", pull: "clone", put: false },
//       sort: false,
//     });

//     new Sortable(canvasEl, {
//       group: "shared",
//       animation: 150,
//       ghostClass: "ghost-class",
//       onAdd: function (evt) {
//         $("#canvas-placeholder").hide();
//         let itemEl = evt.item;

//         let type = itemEl.dataset.type;
//         let fieldname = itemEl.dataset.fieldname || "";
//         let label = itemEl.dataset.label || itemEl.innerText.trim();

//         let newCanvasItem = me.create_canvas_item_element(
//           type,
//           label,
//           fieldname,
//         );
//         itemEl.replaceWith(newCanvasItem);
//       },
//     });
//   }

//   create_canvas_item_element(type, label, fieldname) {
//     let wrapper = document.createElement("div");
//     wrapper.className = "canvas-item";
//     wrapper.dataset.type = type;
//     wrapper.dataset.fieldname = fieldname;
//     wrapper.dataset.label = label;

//     let content = "";
//     if (type === "heading") {
//       content = `<input type="text" class="form-control form-control-sm font-weight-bold" value="${label}" onchange="this.parentElement.dataset.label = this.value">`;
//     } else if (type === "field") {
//       content = `<div class="d-flex justify-content-between"><span><strong>${label}</strong> (${fieldname})</span><span class="text-muted">[Field Value]</span></div>`;
//     } else if (type === "table") {
//       content = `<div><strong>Table: ${label}</strong> (${fieldname})<div class="small text-muted mt-1">Rendered dynamically on print</div></div>`;
//     } else if (type === "spacer") {
//       content = `<div class="text-center text-muted small">--- Spacer Block ---</div>`;
//     }

//     wrapper.innerHTML = `
//             <span class="remove-btn" onclick="this.parentElement.remove()">&times;</span>
//             ${content}
//         `;
//     return wrapper;
//   }

//   save_layout() {
//     let doctype = this.selectedDocType;
//     let formatName = $("#format-name-input").val().trim();

//     if (!doctype) {
//       frappe.msgprint(__("Please select a DocType."));
//       return;
//     }
//     if (!formatName) {
//       frappe.msgprint(__("Please provide a Format Name."));
//       return;
//     }

//     let canvasElements = document.querySelectorAll("#canvas .canvas-item");
//     let layout = [];

//     canvasElements.forEach((el) => {
//       layout.push({
//         type: el.dataset.type,
//         fieldname: el.dataset.fieldname || "",
//         label: el.dataset.label || "",
//         text: el.querySelector("input") ? el.querySelector("input").value : "",
//       });
//     });

//     if (layout.length === 0) {
//       frappe.msgprint(__("Canvas is empty! Drag some items first."));
//       return;
//     }

//     frappe.call({
//       method: "participatory_backend.api.save_custom_print_format",
//       args: {
//         doctype_name: doctype,
//         format_name: formatName,
//         layout_json: JSON.stringify(layout),
//       },
//       callback: (r) => {
//         if (!r.exc) {
//           frappe.show_alert({
//             message: __("Print Format Saved Successfully!"),
//             indicator: "green",
//           });
//         }
//       },
//     });
//   }
// }

frappe.pages["custom-print-designer"].on_page_load = function (wrapper) {
  var page = frappe.ui.make_app_page({
    parent: wrapper,
    title: __("Print Layout Designer"),
    single_column: true,
  });

  // Dynamically load SortableJS library
  frappe.require(
    "https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js",
    function () {
      new PrintDesigner(page);
    },
  );
};

class PrintDesigner {
  constructor(page) {
    this.page = page;
    this.selectedDocType = null;
    this.doctypeFields = [];
    this.canvasItems = [];

    this.render_layout();
    this.setup_toolbar();
  }

  setup_toolbar() {
    let me = this;

    // Create a field container in the page header
    const $field_area = $(`
      <div
        class="row mb-3"
        style="display:flex; width:100%; gap:15px; align-items:center; padding:10px"
      >
        <div style="flex:1; min-width:0;" class="item-one"></div>
		<div style="flex:1; min-width:0;" class="item-two"></div>
      </div>,
    `);

    $(this.page.body).prepend($field_area);

    // DocType Selector Dropdown
    frappe.ui.form.make_control({
      parent: $field_area.find(".item-one"),
      df: {
        fieldname: "doctype_select",
        label: __("Select DocType"),
        fieldtype: "Link",
        options: "DocType",
        reqd: 1,
        get_query: function () {
          return { filters: { custom: 1 } }; // Filter for custom doctypes
        },
        change() {
          me.selectedDocType = this.get_value();
          me.load_doctype_fields();
        },
      },
      render_input: true,
    });

    // Format Name Input
    this.format_name_field = frappe.ui.form.make_control({
      parent: $field_area.find(".item-two"),
      df: {
        fieldname: "format_name",
        label: __("Format Name"),
        fieldtype: "Data",
        placeholder: "My Custom Print Layout",
        reqd: 1,
      },
      render_input: true,
    });

    // Save Button
    this.page.set_primary_action(__("Save Print Format"), () =>
      this.save_layout(),
    );
  }

  render_layout() {
    this.page.main.html(`
            <style>
                .designer-container { display: flex; gap: 20px; height: calc(100vh - 180px); padding: 15px; }
                .palette { width: 300px; background: #f8f9fa; border: 1px solid #d1d8dd; border-radius: 8px; padding: 15px; overflow-y: auto; }
                .canvas-wrapper { flex: 1; background: #eaeded; border: 1px solid #d1d8dd; border-radius: 8px; padding: 20px; overflow-y: auto; display: flex; justify-content: center; }
                .paper-canvas { width: 100%; max-width: 700px; min-height: 800px; background: #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.1); border-radius: 4px; padding: 30px; }
                .drag-item { background: #fff; border: 1px solid #d1d8dd; border-radius: 4px; padding: 10px 12px; margin-bottom: 8px; cursor: grab; font-weight: 500; }
                .canvas-item { border: 1px dashed #a0aec0; border-radius: 4px; padding: 12px; margin-bottom: 10px; background: #f7fafc; position: relative; }
                .canvas-item .remove-btn { position: absolute; right: 8px; top: 8px; color: #e53e3e; cursor: pointer; }
                .ghost-class { opacity: 0.4; background: #edf2f7; }
            </style>

            <div class="designer-container">
                <!-- Left Palette Sidebar -->
                <div class="palette">
                    <h6 class="text-muted uppercase font-weight-bold mb-3">${__("Elements")}</h6>
                    <div id="static-elements">
                        <div class="drag-item" data-type="heading">${__("Title / Heading")}</div>
                        <div class="drag-item" data-type="spacer">${__("Spacer Block")}</div>
                    </div>

                    <h6 class="text-muted uppercase font-weight-bold my-3">${__("DocType Fields")}</h6>
                    <div id="field-elements">
                        <p class="text-muted small">${__("Select a DocType to load fields")}</p>
                    </div>
                </div>

                <!-- Center Print Canvas -->
                <div class="canvas-wrapper">
                    <div class="paper-canvas" id="canvas">
                        <p class="text-muted text-center mt-5" id="canvas-placeholder">${__("Drag elements here from the left sidebar")}</p>
                    </div>
                </div>
            </div>
        `);

    this.init_drag_drop();
  }

  load_doctype_fields() {
    if (!this.selectedDocType) return;

    frappe.model.with_doctype(this.selectedDocType, () => {
      let meta = frappe.get_meta(this.selectedDocType);
      let fieldsContainer = $(this.page.main).find("#field-elements");
      fieldsContainer.empty();

      meta.fields.forEach((f) => {
        if (!["Section Break", "Column Break"].includes(f.fieldtype)) {
          fieldsContainer.append(`
                        <div class="drag-item" data-type="${f.fieldtype === "Table" ? "table" : "field"}" data-fieldname="${f.fieldname}" data-label="${f.label}">
                            ${f.label} <span class="badge badge-light text-muted float-right">${f.fieldtype}</span>
                        </div>
                    `);
        }
      });
    });
  }

  init_drag_drop() {
    let me = this;
    let canvasEl = document.getElementById("canvas");

    // Allow dragging from static sidebar
    new Sortable(document.getElementById("static-elements"), {
      group: { name: "shared", pull: "clone", put: false },
      sort: false,
    });

    // Allow dragging from dynamic field sidebar
    new Sortable(document.getElementById("field-elements"), {
      group: { name: "shared", pull: "clone", put: false },
      sort: false,
    });

    // Dropzone Canvas Setup
    new Sortable(canvasEl, {
      group: "shared",
      animation: 150,
      ghostClass: "ghost-class",
      onAdd: function (evt) {
        $("#canvas-placeholder").hide();
        let itemEl = evt.item;

        // Extract metadata from dataset
        let type = itemEl.dataset.type;
        let fieldname = itemEl.dataset.fieldname || "";
        let label = itemEl.dataset.label || itemEl.innerText.trim();

        // Replace dragged raw element with canvas UI component
        let newCanvasItem = me.create_canvas_item_element(
          type,
          label,
          fieldname,
        );
        itemEl.replaceWith(newCanvasItem);
      },
    });
  }

  create_canvas_item_element(type, label, fieldname) {
    let wrapper = document.createElement("div");
    wrapper.className = "canvas-item";
    wrapper.dataset.type = type;
    wrapper.dataset.fieldname = fieldname;
    wrapper.dataset.label = label;

    let content = "";
    if (type === "heading") {
      content = `<input type="text" class="form-control form-control-sm font-weight-bold" value="${label}" onchange="this.parentElement.dataset.label = this.value">`;
    } else if (type === "field") {
      content = `<div class="d-flex justify-content-between"><span><strong>${label}</strong> (${fieldname})</span><span class="text-muted">[Field Value]</span></div>`;
    } else if (type === "table") {
      content = `<div><strong>Table: ${label}</strong> (${fieldname})<div class="small text-muted mt-1">Rendered dynamically on print</div></div>`;
    } else if (type === "spacer") {
      content = `<div class="text-center text-muted small">--- Spacer Block (20px) ---</div>`;
    }

    wrapper.innerHTML = `
            <span class="remove-btn" onclick="this.parentElement.remove()">&times;</span>
            ${content}
        `;
    return wrapper;
  }

  save_layout() {
    let doctype = this.selectedDocType;
    let formatName = this.format_name_field.get_value();

    if (!doctype) {
      frappe.msgprint(__("Please select a DocType."));
      return;
    }
    if (!formatName) {
      frappe.msgprint(__("Please provide a Format Name."));
      return;
    }

    // Collect all elements from Canvas DOM
    let canvasElements = document.querySelectorAll("#canvas .canvas-item");
    let layout = [];

    canvasElements.forEach((el) => {
      layout.push({
        type: el.dataset.type,
        fieldname: el.dataset.fieldname || "",
        label: el.dataset.label || "",
        text: el.querySelector("input") ? el.querySelector("input").value : "",
      });
    });

    if (layout.length === 0) {
      frappe.msgprint(__("Canvas is empty! Drag some items first."));
      return;
    }

    // Send to Whitelisted Python Backend
    frappe.call({
      method: "participatory_backend.api.save_custom_print_format",
      args: {
        doctype_name: doctype,
        format_name: formatName,
        layout_json: JSON.stringify(layout),
      },
      callback: (r) => {
        if (!r.exc) {
          frappe.show_alert({
            message: __("Print Format Saved Successfully!"),
            indicator: "green",
          });
        }
      },
    });
  }
}
