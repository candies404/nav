import { ElMessage, ElMessageBox } from "element-plus";
import {
  ActionbarClickEvent,
  ButtonsProps
} from "@fast-crud/fast-crud/dist/d/d/crud";
import { type CrudExpose } from "@fast-crud/fast-crud/dist/d/d/expose";
import type Crud from "@/api/crud";
import { message } from "@/utils/message";

export function useActionButtons(
  crudExpose: CrudExpose,
  model: Crud
): ButtonsProps<ActionbarClickEvent> {
  return {
    save: {
      text: "保存",
      type: "success",
      click: () => {
        crudExpose.getTableRef().editable.submit(async ({ changed }) => {
          console.log("changed", changed);
          if (changed.length > 0) {
            const updatePromises = changed.map(async item => {
              await model.update(item.id, item);
            });
            // 等待所有更新操作完成
            await Promise.all(updatePromises);
            ElMessage.success("保存成功");

            await crudExpose.doRefresh();
            // setData({ 0: {id:1} }); //设置data
          } else {
            ElMessage.warning("没有数据需要保存");
          }
        });
      }
    },
    deleteAll: {
      text: "批量删除",
      type: "danger",
      click: () => {
        ElMessageBox.confirm("确定要批量删除吗？").then(async () => {
          const selected = crudExpose
            .getTableRef()
            .tableRef.getSelectionRows()
            .map(item => item.id);
          if (selected.length > 0) {
            model.delete(selected.join(",")).then(async () => {
              await crudExpose.doRefresh();
              message("删除成功", { type: "success" });
            });
          } else {
            message("请选择要删除的数据", { type: "error" });
          }
        });
      }
    }
  };
}
