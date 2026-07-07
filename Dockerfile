FROM debian:trixie-slim

ENV DEBIAN_FRONTEND=noninteractive

# Debian-packaged nginx + lua-nginx-module stack (patched under Trixie LTS),
# plus luarocks for the libraries Debian does not package (lua-cjson comes from
# LuaRocks too: the OpenResty fork with encode_empty_table_as_object, which
# Debian's upstream-flavored lua-cjson lacks)
RUN apt-get update && apt-get install -y --no-install-recommends \
        nginx \
        libnginx-mod-http-lua \
        luajit \
        luarocks \
        liblua5.1-0-dev \
        libargon2-1 \
        ca-certificates \
        gcc \
        libc6-dev \
        libargon2-dev \
        git \
    && luarocks --lua-version=5.1 install lua-cjson \
    && luarocks --lua-version=5.1 install lua-resty-string \
    && luarocks --lua-version=5.1 install pgmoon \
    && luarocks --lua-version=5.1 install lua-resty-jwt \
    && luarocks --lua-version=5.1 install argon2 \
    && apt-get purge -y gcc libc6-dev libargon2-dev liblua5.1-0-dev git \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

# modules-enabled confs reference "modules/" relative to the nginx prefix (-p /app)
RUN mkdir -p target && ln -s /usr/lib/nginx/modules modules

# Database config is supplied at run time: docker run --env-file .env
ENV LUA_PATH="./app/?.lua;/usr/local/share/lua/5.1/?.lua;/usr/local/share/lua/5.1/?/init.lua;;" \
    LUA_CPATH="/usr/local/lib/lua/5.1/?.so;;"

EXPOSE 8081

CMD ["nginx", "-p", "/app", "-c", "nginx.conf", "-g", "daemon off;"]
