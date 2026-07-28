-- Article routes for RealWorld API
-- Handles article CRUD, tags, favorites

local router = require("router")
local json = require("lunet.jsonic")
local db = require("db")
local web = require("web")
local crypto = require("lib.crypto")

local json_response = web.json_response
local error_response = web.error_response
local get_current_user = web.get_current_user
local JSON_NULL = json.null

local function format_author(env_config, author, current_user_id, followed_author_ids)
    local formatted = {
        username = author.username,
        bio = author.bio or JSON_NULL,
        image = author.image or JSON_NULL,
        following = false
    }

    if followed_author_ids then
        local author_id = author.author_id or author.id
        formatted.following = followed_author_ids[author_id] or false
    elseif current_user_id and current_user_id ~= author.author_id and current_user_id ~= author.id then
        local author_id = author.author_id or author.id
        local is_following, _ = db.is_following(env_config, current_user_id, author_id)
        formatted.following = is_following
    end

    return formatted
end

local function optional_current_user(env_config, ctx)
    local user, token, err = get_current_user(env_config, ctx)
    if not user and ctx.headers["authorization"] then
        return nil, token, err
    end
    return user, token, nil
end

local function parse_pagination(ctx)
    local function parse_integer(name, default, minimum)
        local value = ctx.query[name]
        if value == nil then
            return default
        end
        if type(value) ~= "string" or not value:match("^%d+$") then
            return nil, { [name] = { "must be an integer" } }
        end
        local number = tonumber(value)
        if not number or number < minimum then
            return nil, { [name] = { "must be greater than or equal to " .. minimum } }
        end
        return number
    end

    local limit, limit_err = parse_integer("limit", 20, 1)
    if not limit then
        return nil, nil, limit_err
    end
    local offset, offset_err = parse_integer("offset", 0, 0)
    if not offset then
        return nil, nil, offset_err
    end
    return limit, offset, nil
end

local function is_string_array(value)
    if value == JSON_NULL or type(value) ~= "table" then
        return false
    end
    for key, item in pairs(value) do
        if type(key) ~= "number" or key < 1 or key % 1 ~= 0 or key > #value or type(item) ~= "string" then
            return false
        end
    end
    return true
end

-- Helper to format article response
local function format_article(env_config, article, current_user_id, include_body)
    if not article then
        return nil
    end
    
    if include_body == nil then include_body = true end
    
    local formatted = {
        slug = article.slug,
        title = article.title,
        description = article.description,
        createdAt = article.created_at,
        updatedAt = article.updated_at,
        favorited = false,
        favoritesCount = article.favorites_count or 0,
        author = format_author(env_config, article, current_user_id)
    }
    
    if include_body then
        formatted.body = article.body
    end
    
    -- Get tags
    local tags, _ = db.get_article_tags(env_config, article.id)
    if tags and #tags > 0 then
        formatted.tagList = tags
    else
        formatted.tagList = {}
    end
    
    -- Check if favorited by current user
    if current_user_id then
        local is_favorited, _ = db.is_favorited(env_config, current_user_id, article.id)
        formatted.favorited = is_favorited
        
    end
    
    return formatted
end

-- Helper to format articles list (without body)
local function format_articles_list(env_config, articles, current_user_id)
    local article_ids = {}
    local author_ids = {}
    local seen_author_ids = {}
    for _, article in ipairs(articles) do
        table.insert(article_ids, article.id)
        if current_user_id and article.author_id ~= current_user_id and not seen_author_ids[article.author_id] then
            seen_author_ids[article.author_id] = true
            table.insert(author_ids, article.author_id)
        end
    end

    local tags_by_article, err = db.get_article_tags_for_articles(env_config, article_ids)
    if not tags_by_article then
        return nil, err
    end

    local favorited_article_ids = {}
    local followed_author_ids = {}
    if current_user_id then
        local favorited, favorite_err = db.get_favorited_article_ids(env_config, current_user_id, article_ids)
        if not favorited then
            return nil, favorite_err
        end
        favorited_article_ids = favorited

        local followed, follow_err = db.get_followed_author_ids(env_config, current_user_id, author_ids)
        if not followed then
            return nil, follow_err
        end
        followed_author_ids = followed
    end

    local formatted = {}
    for _, article in ipairs(articles) do
        table.insert(formatted, {
            slug = article.slug,
            title = article.title,
            description = article.description,
            tagList = tags_by_article[article.id] or {},
            createdAt = article.created_at,
            updatedAt = article.updated_at,
            favorited = favorited_article_ids[article.id] or false,
            favoritesCount = article.favorites_count or 0,
            author = {
                username = article.username,
                bio = article.bio or JSON_NULL,
                image = article.image or JSON_NULL,
                following = followed_author_ids[article.author_id] or false
            }
        })
    end
    return formatted, nil
end

-- Helper to generate slug from title
local function generate_slug(title)
    -- Simple slug generation: lowercase, replace spaces with hyphens, remove special chars
    local slug = string.lower(title)
    slug = slug:gsub("[^a-z0-9%-_]", "-")
    slug = slug:gsub("%-+", "-")
    slug = slug:gsub("^%-+", "")
    slug = slug:gsub("%-+$", "")
    -- CSPRNG suffix keeps slugs unique across workers and concurrent requests
    local suffix = crypto.random_bytes(4):gsub(".", function(c) return string.format("%02x", c:byte()) end)
    return slug .. "-" .. suffix
end

-- List articles
router.route("GET", "/api/articles", function(env_config, ctx, params)
    local user, token, err = optional_current_user(env_config, ctx)
    if not user and err then
        return error_response(401, err)
    end
    local current_user_id = user and user.id or nil
    
    -- Parse query parameters
    local limit, offset, pagination_err = parse_pagination(ctx)
    if pagination_err then
        return error_response(422, pagination_err)
    end
    local author = ctx.query.author
    local tag = ctx.query.tag
    local favorited = ctx.query.favorited
    
    -- Get author_id if author param is provided
    local author_id = nil
    if author then
        local profile = web.fetched(db.get_profile_by_username(env_config, author))
        if profile then
            author_id = profile.id
        else
            return error_response(422, { author = { "not found" } })
        end
    end
    
    -- Get favorited user_id if favorited param is provided
    local favorited_id = nil
    if favorited then
        local profile = web.fetched(db.get_profile_by_username(env_config, favorited))
        if profile then
            favorited_id = profile.id
        else
            return error_response(422, { favorited = { "not found" } })
        end
    end
    
    local articles, err, total_count = db.list_articles(env_config, limit, offset, author_id, tag, favorited_id)
    if err then
        return error_response(500, { database = { err } })
    end
    
    local formatted_articles, format_err = format_articles_list(env_config, articles, current_user_id)
    if not formatted_articles then
        return error_response(500, { database = { format_err } })
    end
    return json_response(200, {
        articles = formatted_articles,
        articlesCount = total_count
    })
end)

-- Feed (articles from followed users)
router.route("GET", "/api/articles/feed", function(env_config, ctx, params)
    local user, token, err = get_current_user(env_config, ctx)
    if not user then
        return error_response(401, err)
    end
    
    local limit, offset, pagination_err = parse_pagination(ctx)
    if pagination_err then
        return error_response(422, pagination_err)
    end
    
    local articles, err, total_count = db.get_feed(env_config, user.id, limit, offset)
    if err then
        return error_response(500, { database = { err } })
    end
    
    local formatted_articles, format_err = format_articles_list(env_config, articles, user.id)
    if not formatted_articles then
        return error_response(500, { database = { format_err } })
    end
    return json_response(200, {
        articles = formatted_articles,
        articlesCount = total_count
    })
end)

-- Get article by slug
router.route("GET", "/api/articles/:slug", function(env_config, ctx, params)
    local user, token, err = optional_current_user(env_config, ctx)
    if not user and err then
        return error_response(401, err)
    end
    local current_user_id = user and user.id or nil
    
    local article = web.fetched(db.get_article_by_slug(env_config, params.slug))
    if not article then
        return error_response(404, { article = { "not found" } })
    end
    
    return json_response(200, { article = format_article(env_config, article, current_user_id) })
end)

-- Create article
router.route("POST", "/api/articles", function(env_config, ctx, params)
    local user, token, err = get_current_user(env_config, ctx)
    if not user then
        return error_response(401, err)
    end
    
    local body = ctx.body
    if not body then
        return error_response(422, { article = { "Missing request body" } })
    end
    
    local ok, data = pcall(json.decode, body)
    if not ok or type(data) ~= "table" then
        return error_response(422, { article = { "Invalid JSON" } })
    end
    
    local article_data = data.article
    if type(article_data) ~= "table" then
        return error_response(422, { article = { "must be an object" } })
    end
    
    -- Validate required fields
    local errors = {}
    if not article_data.title or article_data.title == "" then
        errors.title = { "can't be blank" }
    end
    if not article_data.description or article_data.description == "" then
        errors.description = { "can't be blank" }
    end
    if not article_data.body or article_data.body == "" then
        errors.body = { "can't be blank" }
    end
    if next(errors) then
        return error_response(422, errors)
    end
    
    if article_data.tagList ~= nil and not is_string_array(article_data.tagList) then
        return error_response(422, { tagList = { "must be an array of strings" } })
    end

    -- Generate slug if not provided
    local slug = article_data.slug or generate_slug(article_data.title)
    
    local article, err = db.transaction(env_config, function(tx)
        local created, create_err = db.create_article(env_config, {
            slug = slug,
            title = article_data.title,
            description = article_data.description or "",
            body = article_data.body or "",
            author_id = user.id
        }, tx)
        if not created then
            return nil, create_err
        end

        if article_data.tagList and #article_data.tagList > 0 then
            local tags_ok, tags_err = db.set_article_tags(env_config, created.id, article_data.tagList, tx)
            if not tags_ok then
                return nil, tags_err
            end
        end

        return created, nil
    end)
    
    if not article then
        return error_response(500, { database = { err or "Failed to create article" } })
    end
    
    -- Reload article with author info
    local article2 = web.fetched(db.get_article_by_slug(env_config, slug))
    
    return json_response(201, { article = format_article(env_config, article2, user.id) })
end)

-- Update article
router.route("PUT", "/api/articles/:slug", function(env_config, ctx, params)
    local user, token, err = get_current_user(env_config, ctx)
    if not user then
        return error_response(401, err)
    end
    
    -- Get current article to check ownership
    local current_article = web.fetched(db.get_article_by_slug(env_config, params.slug))
    if not current_article then
        return error_response(404, { article = { "not found" } })
    end
    
    if current_article.author_id ~= user.id then
        return error_response(403, { article = { "forbidden" } })
    end
    
    local body = ctx.body
    if not body then
        return error_response(422, { article = { "Missing request body" } })
    end
    
    local ok, data = pcall(json.decode, body)
    if not ok or type(data) ~= "table" then
        return error_response(422, { article = { "Invalid JSON" } })
    end
    
    local article_data = data.article
    if type(article_data) ~= "table" or next(article_data) == nil then
        return error_response(422, { article = { "must include at least one field" } })
    end
    
    -- Validate tagList if present
    if article_data.tagList ~= nil and not is_string_array(article_data.tagList) then
        return error_response(422, { tagList = { "must be an array of strings" } })
    end
    
    -- Build updates
    local updates = {}
    if article_data.title then updates.title = article_data.title end
    if article_data.description then updates.description = article_data.description end
    if article_data.body then updates.body = article_data.body end
    
    -- Update the article and replace tags on one connection, atomically.
    local article, err = db.transaction(env_config, function(tx)
        local updated, update_err = db.update_article(env_config, params.slug, updates, tx)
        if not updated then
            return nil, update_err
        end

        if article_data.tagList ~= nil then
            local tags_ok, tags_err = db.set_article_tags(env_config, updated.id, article_data.tagList, tx)
            if not tags_ok then
                return nil, tags_err
            end
        end

        return updated, nil
    end)
    if not article then
        return error_response(500, { database = { err or "Failed to update article" } })
    end
    
    -- Reload article with author info
    local article2 = web.fetched(db.get_article_by_slug(env_config, params.slug))
    
    return json_response(200, { article = format_article(env_config, article2, user.id) })
end)

-- Delete article
router.route("DELETE", "/api/articles/:slug", function(env_config, ctx, params)
    local user, token, err = get_current_user(env_config, ctx)
    if not user then
        return error_response(401, err)
    end
    
    -- Get current article to check ownership
    local current_article = web.fetched(db.get_article_by_slug(env_config, params.slug))
    if not current_article then
        return error_response(404, { article = { "not found" } })
    end
    
    if current_article.author_id ~= user.id then
        return error_response(403, { article = { "forbidden" } })
    end
    
    local ok, err = db.delete_article(env_config, params.slug)
    if not ok then
        return error_response(500, { database = { err or "Failed to delete article" } })
    end
    
    return json_response(204, nil)
end)

-- Get article comments
router.route("GET", "/api/articles/:slug/comments", function(env_config, ctx, params)
    -- Check if article exists first
    local article = web.fetched(db.get_article_by_slug(env_config, params.slug))
    if not article then
        return error_response(404, { article = { "not found" } })
    end
    
    local user, token, err = optional_current_user(env_config, ctx)
    if not user and err then
        return error_response(401, err)
    end
    local current_user_id = user and user.id or nil
    
    local comments, err = db.get_comments_by_article(env_config, params.slug)
    if err then
        return error_response(500, { database = { err } })
    end

    local followed_author_ids = {}
    if current_user_id then
        local author_ids = {}
        local seen_author_ids = {}
        for _, comment in ipairs(comments or {}) do
            if comment.author_id ~= current_user_id and not seen_author_ids[comment.author_id] then
                seen_author_ids[comment.author_id] = true
                table.insert(author_ids, comment.author_id)
            end
        end
        local followed, follow_err = db.get_followed_author_ids(env_config, current_user_id, author_ids)
        if not followed then
            return error_response(500, { database = { follow_err } })
        end
        followed_author_ids = followed
    end
    
    -- Format comments
    local formatted_comments = {}
    for _, comment in ipairs(comments or {}) do
        table.insert(formatted_comments, {
            id = comment.id,
            body = comment.body,
            createdAt = comment.created_at,
            updatedAt = comment.updated_at,
            author = format_author(env_config, comment, current_user_id, followed_author_ids)
        })
    end
    
    return json_response(200, { comments = formatted_comments })
end)

-- Create comment
router.route("POST", "/api/articles/:slug/comments", function(env_config, ctx, params)
    local user, token, err = get_current_user(env_config, ctx)
    if not user then
        return error_response(401, err)
    end
    
    -- Get article to verify it exists
    local article = web.fetched(db.get_article_by_slug(env_config, params.slug))
    if not article then
        return error_response(404, { article = { "not found" } })
    end
    
    local body = ctx.body
    if not body then
        return error_response(422, { comment = { "Missing request body" } })
    end
    
    local ok, data = pcall(json.decode, body)
    if not ok or not data then
        return error_response(422, { comment = { "Invalid JSON" } })
    end
    
    local comment_data = data.comment or {}
    
    if not comment_data.body or comment_data.body == "" then
        return error_response(422, { body = { "can't be blank" } })
    end
    
    local comment, err = db.create_comment(env_config, {
        body = comment_data.body,
        author_id = user.id,
        article_id = article.id
    })
    
    if not comment then
        return error_response(500, { database = { err or "Failed to create comment" } })
    end
    
    -- Format response
    local formatted = {
        id = comment.id,
        body = comment.body,
        createdAt = comment.created_at,
        updatedAt = comment.updated_at,
        author = format_author(env_config, user, user.id)
    }
    
    return json_response(201, { comment = formatted })
end)

-- Delete comment
router.route("DELETE", "/api/articles/:slug/comments/:id", function(env_config, ctx, params)
    local user, token, err = get_current_user(env_config, ctx)
    if not user then
        return error_response(401, err)
    end
    
    -- Check if article exists first
    local article = web.fetched(db.get_article_by_slug(env_config, params.slug))
    if not article then
        return error_response(404, { article = { "not found" } })
    end
    
    local comment = web.fetched(db.get_comment_by_id(env_config, tonumber(params.id)))
    if not comment then
        return error_response(404, { comment = { "not found" } })
    end

    if comment.article_id ~= article.id then
        return error_response(404, { comment = { "not found" } })
    end
    
    -- Check ownership
    if comment.author_id ~= user.id then
        return error_response(403, { comment = { "forbidden" } })
    end
    
    local ok, err = db.delete_comment(env_config, comment.id)
    if not ok then
        return error_response(500, { database = { err or "Failed to delete comment" } })
    end
    
    return json_response(204, nil)
end)

-- Favorite article
router.route("POST", "/api/articles/:slug/favorite", function(env_config, ctx, params)
    local user, token, err = get_current_user(env_config, ctx)
    if not user then
        return error_response(401, err)
    end
    
    local article = web.fetched(db.get_article_by_slug(env_config, params.slug))
    if not article then
        return error_response(404, { article = { "not found" } })
    end
    
    local ok, err = db.favorite_article(env_config, user.id, article.id)
    if not ok then
        return error_response(500, { database = { err or "Failed to favorite article" } })
    end
    
    -- Reload article to get updated favorites count
    local article2 = web.fetched(db.get_article_by_slug(env_config, params.slug))
    
    return json_response(200, { article = format_article(env_config, article2, user.id) })
end)

-- Unfavorite article
router.route("DELETE", "/api/articles/:slug/favorite", function(env_config, ctx, params)
    local user, token, err = get_current_user(env_config, ctx)
    if not user then
        return error_response(401, err)
    end
    
    local article = web.fetched(db.get_article_by_slug(env_config, params.slug))
    if not article then
        return error_response(404, { article = { "not found" } })
    end
    
    local ok, err = db.unfavorite_article(env_config, user.id, article.id)
    if not ok then
        return error_response(500, { database = { err or "Failed to unfavorite article" } })
    end
    
    -- Reload article to get updated favorites count
    local article2 = web.fetched(db.get_article_by_slug(env_config, params.slug))
    
    return json_response(200, { article = format_article(env_config, article2, user.id) })
end)

-- Get tags
router.route("GET", "/api/tags", function(env_config, ctx, params)
    local tags, err = db.get_all_tags(env_config)
    if err then
        return error_response(500, { database = { err } })
    end
    
    return json_response(200, { tags = tags })
end)

return router
