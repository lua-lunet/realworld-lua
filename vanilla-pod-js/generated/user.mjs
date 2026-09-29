// @ts-nocheck
export function validate(instance) {
  const e = [];
  if (instance === null || typeof instance !== "object" || Array.isArray(instance)) {
    e.push({instancePath: "", schemaPath: "" + "/properties"});
  } else {
    if (!("email" in instance)) e.push({instancePath: "", schemaPath: "" + "/properties/email"});
    else {
      if (typeof instance["email"] !== "string") e.push({instancePath: "" + "/email", schemaPath: "" + "/properties/email" + "/type"});
    }
    if (!("token" in instance)) e.push({instancePath: "", schemaPath: "" + "/properties/token"});
    else {
      if (typeof instance["token"] !== "string") e.push({instancePath: "" + "/token", schemaPath: "" + "/properties/token" + "/type"});
    }
    if (!("username" in instance)) e.push({instancePath: "", schemaPath: "" + "/properties/username"});
    else {
      if (typeof instance["username"] !== "string") e.push({instancePath: "" + "/username", schemaPath: "" + "/properties/username" + "/type"});
    }
    if ("bio" in instance) {
      if (instance["bio"] !== null) {
        if (typeof instance["bio"] !== "string") e.push({instancePath: "" + "/bio", schemaPath: "" + "/optionalProperties/bio" + "/type"});
      }
    }
    if ("id" in instance) {
      if (typeof instance["id"] !== "number" || !Number.isFinite(instance["id"])) e.push({instancePath: "" + "/id", schemaPath: "" + "/optionalProperties/id" + "/type"});
    }
    if ("image" in instance) {
      if (instance["image"] !== null) {
        if (typeof instance["image"] !== "string") e.push({instancePath: "" + "/image", schemaPath: "" + "/optionalProperties/image" + "/type"});
      }
    }
    for (const k in instance) {
      if (k !== "email" && k !== "token" && k !== "username" && k !== "bio" && k !== "id" && k !== "image") e.push({instancePath: "" + "/" + k, schemaPath: ""});
    }
  }
  return e;
}
