# Setup: Register
POST {{host}}/api/users
{
  "user": {
    "username": "page_{{uid}}",
    "email": "page_{{uid}}@test.com",
    "password": "password123"
  }
}
HTTP 201
[Captures]
token: jsonpath "$.user.token"

# Create article 1
POST {{host}}/api/articles
Authorization: Token {{token}}
{
  "article": {
    "title": "Pagination 1 {{uid}}",
    "description": "Page test 1",
    "body": "Page body 1"
  }
}
HTTP 201
[Captures]
slug1: jsonpath "$.article.slug"

# Create article 2
POST {{host}}/api/articles
Authorization: Token {{token}}
{
  "article": {
    "title": "Pagination 2 {{uid}}",
    "description": "Page test 2",
    "body": "Page body 2"
  }
}
HTTP 201
[Asserts]
jsonpath "$.article.title" == "Pagination 2 {{uid}}"
jsonpath "$.article.slug" isString
[Captures]
slug2: jsonpath "$.article.slug"

# List with limit=1 (most recent first, so slug2)
GET {{host}}/api/articles?author=page_{{uid}}&limit=1
HTTP 200
[Asserts]
jsonpath "$.articles" count == 1
jsonpath "$.articlesCount" == 2
jsonpath "$.articles[0].slug" == "{{slug2}}"

# List with limit=1&offset=1 (second page, so slug1)
GET {{host}}/api/articles?author=page_{{uid}}&limit=1&offset=1
HTTP 200
[Asserts]
jsonpath "$.articles" count == 1
jsonpath "$.articlesCount" == 2
jsonpath "$.articles[0].slug" == "{{slug1}}"

# Reject non-integer and out-of-bounds pagination values
GET {{host}}/api/articles?author=page_{{uid}}&limit=zero
HTTP 422
[Asserts]
jsonpath "$.errors.limit[0]" == "must be an integer"

GET {{host}}/api/articles?author=page_{{uid}}&limit=0
HTTP 422
[Asserts]
jsonpath "$.errors.limit[0]" == "must be greater than or equal to 1"

GET {{host}}/api/articles?author=page_{{uid}}&offset=-1
HTTP 422
[Asserts]
jsonpath "$.errors.offset[0]" == "must be an integer"

GET {{host}}/api/articles/feed?limit=0
Authorization: Token {{token}}
HTTP 422
[Asserts]
jsonpath "$.errors.limit[0]" == "must be greater than or equal to 1"

# Cleanup
DELETE {{host}}/api/articles/{{slug1}}
Authorization: Token {{token}}
HTTP 204

DELETE {{host}}/api/articles/{{slug2}}
Authorization: Token {{token}}
HTTP 204
