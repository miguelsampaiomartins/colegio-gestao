export const permissionKeys = ["dashboard", "students", "inventory", "sales", "incidents"] as const;
export type PermissionKey = typeof permissionKeys[number];

export const permissionLabels: Record<PermissionKey, string> = {
  dashboard: "Visão geral",
  students: "Alunos e matrículas",
  inventory: "Estoque",
  sales: "Vendas",
  incidents: "Anotações",
};

export const allStaffPermissions = [...permissionKeys] as PermissionKey[];
