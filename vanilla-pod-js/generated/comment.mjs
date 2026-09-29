// @ts-nocheck
export function validate(instance) {
  const e = [];
  if (instance === null || typeof instance !== "object" || Array.isArray(instance)) {
    e.push({instancePath: "", schemaPath: "" + "/properties"});
  } else {
    if (!("author" in instance)) e.push({instancePath: "", schemaPath: "" + "/properties/author"});
    else {
      if (instance["author"] === null || typeof instance["author"] !== "object" || Array.isArray(instance["author"])) {
        e.push({instancePath: "" + "/author", schemaPath: "" + "/properties/author" + "/properties"});
      } else {
        if (!("following" in instance["author"])) e.push({instancePath: "" + "/author", schemaPath: "" + "/properties/author" + "/properties/following"});
        else {
          if (typeof instance["author"]["following"] !== "boolean") e.push({instancePath: "" + "/author" + "/following", schemaPath: "" + "/properties/author" + "/properties/following" + "/type"});
        }
        if (!("username" in instance["author"])) e.push({instancePath: "" + "/author", schemaPath: "" + "/properties/author" + "/properties/username"});
        else {
          if (typeof instance["author"]["username"] !== "string") e.push({instancePath: "" + "/author" + "/username", schemaPath: "" + "/properties/author" + "/properties/username" + "/type"});
        }
        if ("bio" in instance["author"]) {
          if (instance["author"]["bio"] !== null) {
            if (typeof instance["author"]["bio"] !== "string") e.push({instancePath: "" + "/author" + "/bio", schemaPath: "" + "/properties/author" + "/optionalProperties/bio" + "/type"});
          }
        }
        if ("image" in instance["author"]) {
          if (instance["author"]["image"] !== null) {
            if (typeof instance["author"]["image"] !== "string") e.push({instancePath: "" + "/author" + "/image", schemaPath: "" + "/properties/author" + "/optionalProperties/image" + "/type"});
          }
        }
        for (const k in instance["author"]) {
          if (k !== "following" && k !== "username" && k !== "bio" && k !== "image") e.push({instancePath: "" + "/author" + "/" + k, schemaPath: "" + "/properties/author"});
        }
      }
    }
    if (!("body" in instance)) e.push({instancePath: "", schemaPath: "" + "/properties/body"});
    else {
      if (typeof instance["body"] !== "string") e.push({instancePath: "" + "/body", schemaPath: "" + "/properties/body" + "/type"});
    }
    if (!("createdAt" in instance)) e.push({instancePath: "", schemaPath: "" + "/properties/createdAt"});
    else {
      if (typeof instance["createdAt"] !== "string" || !/^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:(\d{2}|60)(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/.test(instance["createdAt"]) || Number.isNaN(Date.parse(instance["createdAt"].replace(/:60/, ":59")))) e.push({instancePath: "" + "/createdAt", schemaPath: "" + "/properties/createdAt" + "/type"});
    }
    if (!("id" in instance)) e.push({instancePath: "", schemaPath: "" + "/properties/id"});
    else {
      if (typeof instance["id"] !== "number" || !Number.isInteger(instance["id"]) || instance["id"] < 0 || instance["id"] > 4294967295) e.push({instancePath: "" + "/id", schemaPath: "" + "/properties/id" + "/type"});
    }
    if (!("updatedAt" in instance)) e.push({instancePath: "", schemaPath: "" + "/properties/updatedAt"});
    else {
      if (typeof instance["updatedAt"] !== "string" || !/^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:(\d{2}|60)(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/.test(instance["updatedAt"]) || Number.isNaN(Date.parse(instance["updatedAt"].replace(/:60/, ":59")))) e.push({instancePath: "" + "/updatedAt", schemaPath: "" + "/properties/updatedAt" + "/type"});
    }
    for (const k in instance) {
      if (k !== "author" && k !== "body" && k !== "createdAt" && k !== "id" && k !== "updatedAt") e.push({instancePath: "" + "/" + k, schemaPath: ""});
    }
  }
  return e;
}
