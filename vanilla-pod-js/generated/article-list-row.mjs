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
    if (!("createdAt" in instance)) e.push({instancePath: "", schemaPath: "" + "/properties/createdAt"});
    else {
      if (typeof instance["createdAt"] !== "string" || !/^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:(\d{2}|60)(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/.test(instance["createdAt"]) || Number.isNaN(Date.parse(instance["createdAt"].replace(/:60/, ":59")))) e.push({instancePath: "" + "/createdAt", schemaPath: "" + "/properties/createdAt" + "/type"});
    }
    if (!("description" in instance)) e.push({instancePath: "", schemaPath: "" + "/properties/description"});
    else {
      if (typeof instance["description"] !== "string") e.push({instancePath: "" + "/description", schemaPath: "" + "/properties/description" + "/type"});
    }
    if (!("favorited" in instance)) e.push({instancePath: "", schemaPath: "" + "/properties/favorited"});
    else {
      if (typeof instance["favorited"] !== "boolean") e.push({instancePath: "" + "/favorited", schemaPath: "" + "/properties/favorited" + "/type"});
    }
    if (!("favoritesCount" in instance)) e.push({instancePath: "", schemaPath: "" + "/properties/favoritesCount"});
    else {
      if (typeof instance["favoritesCount"] !== "number" || !Number.isInteger(instance["favoritesCount"]) || instance["favoritesCount"] < 0 || instance["favoritesCount"] > 4294967295) e.push({instancePath: "" + "/favoritesCount", schemaPath: "" + "/properties/favoritesCount" + "/type"});
    }
    if (!("slug" in instance)) e.push({instancePath: "", schemaPath: "" + "/properties/slug"});
    else {
      if (typeof instance["slug"] !== "string") e.push({instancePath: "" + "/slug", schemaPath: "" + "/properties/slug" + "/type"});
    }
    if (!("tagList" in instance)) e.push({instancePath: "", schemaPath: "" + "/properties/tagList"});
    else {
      if (!Array.isArray(instance["tagList"])) {
        e.push({instancePath: "" + "/tagList", schemaPath: "" + "/properties/tagList" + "/elements"});
      } else {
        for (let i = 0; i < instance["tagList"].length; i++) {
          if (typeof instance["tagList"][i] !== "string") e.push({instancePath: "" + "/tagList" + "/" + i, schemaPath: "" + "/properties/tagList" + "/elements" + "/type"});
        }
      }
    }
    if (!("title" in instance)) e.push({instancePath: "", schemaPath: "" + "/properties/title"});
    else {
      if (typeof instance["title"] !== "string") e.push({instancePath: "" + "/title", schemaPath: "" + "/properties/title" + "/type"});
    }
    if (!("updatedAt" in instance)) e.push({instancePath: "", schemaPath: "" + "/properties/updatedAt"});
    else {
      if (typeof instance["updatedAt"] !== "string" || !/^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:(\d{2}|60)(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/.test(instance["updatedAt"]) || Number.isNaN(Date.parse(instance["updatedAt"].replace(/:60/, ":59")))) e.push({instancePath: "" + "/updatedAt", schemaPath: "" + "/properties/updatedAt" + "/type"});
    }
    for (const k in instance) {
      if (k !== "author" && k !== "createdAt" && k !== "description" && k !== "favorited" && k !== "favoritesCount" && k !== "slug" && k !== "tagList" && k !== "title" && k !== "updatedAt") e.push({instancePath: "" + "/" + k, schemaPath: ""});
    }
  }
  return e;
}
