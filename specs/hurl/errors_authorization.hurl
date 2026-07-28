# Register user A
POST {{host}}/api/users
{
  "user": {
    "username": "authz_a_{{uid}}",
    "email": "authz_a_{{uid}}@test.com",
    "password": "password123"
  }
}
HTTP 201
[Captures]
token_a: jsonpath "$.user.token"

# Register user B
POST {{host}}/api/users
{
  "user": {
    "username": "authz_b_{{uid}}",
    "email": "authz_b_{{uid}}@test.com",
    "password": "password123"
  }
}
HTTP 201
[Captures]
token_b: jsonpath "$.user.token"

# Optional-auth endpoints reject a supplied invalid token rather than treating it as anonymous
GET {{host}}/api/articles
Authorization: Token invalid-token
HTTP 401
[Asserts]
jsonpath "$.errors.token[0]" == "is invalid"

GET {{host}}/api/profiles/authz_b_{{uid}}
Authorization: Token invalid-token
HTTP 401
[Asserts]
jsonpath "$.errors.token[0]" == "is invalid"

# User A creates article
POST {{host}}/api/articles
Authorization: Token {{token_a}}
{
  "article": {
    "title": "Authz Article {{uid}}",
    "description": "test",
    "body": "test"
  }
}
HTTP 201
[Captures]
slug: jsonpath "$.article.slug"

GET {{host}}/api/articles/{{slug}}
Authorization: Token invalid-token
HTTP 401
[Asserts]
jsonpath "$.errors.token[0]" == "is invalid"

# User B tries to delete -> 403
DELETE {{host}}/api/articles/{{slug}}
Authorization: Token {{token_b}}
HTTP 403
[Asserts]
jsonpath "$.errors.article[0]" == "forbidden"

# User B tries to update -> 403
PUT {{host}}/api/articles/{{slug}}
Authorization: Token {{token_b}}
{
  "article": {
    "body": "hijacked"
  }
}
HTTP 403
[Asserts]
jsonpath "$.errors.article[0]" == "forbidden"

# User A creates a comment on the article
POST {{host}}/api/articles/{{slug}}/comments
Authorization: Token {{token_a}}
{
  "comment": {
    "body": "A's comment"
  }
}
HTTP 201
[Captures]
comment_id: jsonpath "$.comment.id"

GET {{host}}/api/articles/{{slug}}/comments
Authorization: Token invalid-token
HTTP 401
[Asserts]
jsonpath "$.errors.token[0]" == "is invalid"

# A comment cannot be deleted through another article's URL.
POST {{host}}/api/articles
Authorization: Token {{token_a}}
{
  "article": {
    "title": "Other Article {{uid}}",
    "description": "test",
    "body": "test"
  }
}
HTTP 201
[Captures]
other_slug: jsonpath "$.article.slug"

DELETE {{host}}/api/articles/{{other_slug}}/comments/{{comment_id}}
Authorization: Token {{token_a}}
HTTP 404
[Asserts]
jsonpath "$.errors.comment[0]" == "not found"

GET {{host}}/api/articles/{{slug}}/comments
HTTP 200
[Asserts]
jsonpath "$.comments" count == 1
jsonpath "$.comments[0].id" == {{comment_id}}

# User B tries to delete A's comment -> 403
DELETE {{host}}/api/articles/{{slug}}/comments/{{comment_id}}
Authorization: Token {{token_b}}
HTTP 403
[Asserts]
jsonpath "$.errors.comment[0]" == "forbidden"

# Verify comment survived the failed delete
GET {{host}}/api/articles/{{slug}}/comments
HTTP 200
[Asserts]
jsonpath "$.comments" count >= 1
jsonpath "$.comments[0].body" == "A's comment"

# Cleanup: User A deletes article
DELETE {{host}}/api/articles/{{other_slug}}
Authorization: Token {{token_a}}
HTTP 204

DELETE {{host}}/api/articles/{{slug}}
Authorization: Token {{token_a}}
HTTP 204
