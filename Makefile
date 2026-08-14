all: init lint start test

LUNET_TAG := v0.9.2
LUNET_RUN := .lunet/$(LUNET_TAG)/lunet-run

PID_FILE = target/lunet.pid
EDGE_PID_FILE = target/edge.pid

deps:
	@if command -v lua >/dev/null 2>&1; then \
		lua scripts/lunet_fetch_release_v0.9.2.lua; \
	elif mise exec -- command -v lua >/dev/null 2>&1; then \
		mise exec -- lua scripts/lunet_fetch_release_v0.9.2.lua; \
	else \
		echo "ERROR: lua is required (on PATH or via mise) to fetch the lunet release."; exit 1; \
	fi

init:
	@test -f .env || { echo "ERROR: .env is missing. Copy .env.example to .env first."; exit 1; }
	@echo "Checking dependencies..."
	@command -v mise >/dev/null 2>&1 || { echo "ERROR: mise is not installed. Please install: curl https://mise.run | sh"; exit 1; }
	@echo "  mise: OK"
	@mise trust --quiet 2>/dev/null || { echo "ERROR: mise is not trusted. Please run: mise trust"; exit 1; }
	@mise install --yes
	@echo "  mise tools: OK"
	@command -v curl >/dev/null 2>&1 || { echo "ERROR: curl is not installed. Please install: brew install curl"; exit 1; }
	@echo "  curl: OK"
	@test -x $(LUNET_RUN) || $(MAKE) deps
	@echo "  lunet-run: OK"
	@mise exec -- hurl --version 2>/dev/null | grep -qE ' 8\.' || { echo "ERROR: hurl 8.x is required (via mise)."; exit 1; }
	@echo "  hurl: OK"
	@mise exec -- command -v lua-language-server >/dev/null 2>&1 || { echo "ERROR: lua-language-server is not installed via mise."; exit 1; }
	@echo "  lua-language-server: OK"
	@command -v psql >/dev/null 2>&1 || { echo "ERROR: psql is not installed. Install the PostgreSQL client first."; exit 1; }
	@echo "  psql: OK"
	@echo "Initializing database..."
	@. ./.env; \
	echo "  Connecting to PostgreSQL at $$PGHOST:$$PGPORT, database: $$PGDATABASE, user: $$PGUSER"; \
	PGPASSWORD=$$PGPASSWORD psql -v ON_ERROR_STOP=1 -h $$PGHOST -p $$PGPORT -U $$PGUSER -d $$PGDATABASE -f sql/schema.sql \
		|| { echo "ERROR: schema initialization failed. Check PostgreSQL is running and the .env connection values are correct."; exit 1; }
	@echo "Database initialized."

db-up:
	@test -f .env || { echo "ERROR: .env is missing. Copy .env.example to .env first."; exit 1; }
	@docker compose up -d --wait postgres
	@echo "PostgreSQL is ready. Run 'make init' to load the schema."

db-down:
	@docker compose down --volumes --remove-orphans
	@echo "Disposable development database removed."

dev: db-up init start
	@echo "Development API is ready at http://localhost:8081/api."

seed: init start
	@./scripts/seed.sh

api-docs:
	@docker compose --profile docs up -d --wait api-docs
	@echo "Swagger UI is available at http://localhost:8082/."

api-docs-stop:
	@docker compose --profile docs stop api-docs
	@docker compose --profile docs rm -f api-docs

docker-build:
	@docker build --platform linux/amd64 -t realworld-lua .

start:
	@if [ -f $(PID_FILE) ] && kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
		echo "Server already running (PID $$(cat $(PID_FILE)))."; \
	else \
		mkdir -p target; \
		. ./.env; \
		nohup $(LUNET_RUN) server.lua > target/server.log 2>&1 & \
		echo $$! > $(PID_FILE); \
		sleep 1; \
		kill -0 $$(cat $(PID_FILE)) 2>/dev/null \
			|| { echo "ERROR: server died at startup (port already in use?). See target/server.log"; rm -f $(PID_FILE); exit 1; }; \
		curl -fsS http://localhost:8081/health >/dev/null \
			&& echo "Server started on port 8081 (PID $$(cat $(PID_FILE)))." \
			|| { echo "ERROR: server failed to start. See target/server.log"; exit 1; }; \
	fi

stop:
	@if [ -f $(PID_FILE) ] && kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
		kill $$(cat $(PID_FILE)); \
		while kill -0 $$(cat $(PID_FILE)) 2>/dev/null; do sleep 1; done; \
		rm -f $(PID_FILE); \
		echo "Server stopped."; \
	else \
		rm -f $(PID_FILE); \
		echo "Server is not running."; \
	fi

restart: stop start

frontend:
	@./scripts/frontend.sh
	@test -x $(LUNET_RUN) || $(MAKE) deps
	@if [ -f $(EDGE_PID_FILE) ] && kill -0 $$(cat $(EDGE_PID_FILE)) 2>/dev/null; then \
		echo "Edge already running (PID $$(cat $(EDGE_PID_FILE)))."; \
	else \
		mkdir -p target; \
		nohup $(LUNET_RUN) edge/server.lua > target/edge.log 2>&1 & \
		echo $$! > $(EDGE_PID_FILE); \
		sleep 1; \
		kill -0 $$(cat $(EDGE_PID_FILE)) 2>/dev/null \
			|| { echo "ERROR: edge died at startup (port already in use?). See target/edge.log"; rm -f $(EDGE_PID_FILE); exit 1; }; \
		curl -fsS http://localhost:8083/ >/dev/null \
			&& echo "Edge serving the frontend on http://localhost:8083 (PID $$(cat $(EDGE_PID_FILE)))." \
			|| { echo "ERROR: edge failed to start. See target/edge.log"; exit 1; }; \
	fi

bundle:
	@./scripts/bundle.sh

frontend-stop:
	@if [ -f $(EDGE_PID_FILE) ] && kill -0 $$(cat $(EDGE_PID_FILE)) 2>/dev/null; then \
		kill $$(cat $(EDGE_PID_FILE)); \
		while kill -0 $$(cat $(EDGE_PID_FILE)) 2>/dev/null; do sleep 1; done; \
		rm -f $(EDGE_PID_FILE); \
		echo "Edge stopped."; \
	else \
		rm -f $(EDGE_PID_FILE); \
		echo "Edge is not running."; \
	fi

status:
	@if [ -f $(PID_FILE) ] && kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
		echo "Server is running (PID $$(cat $(PID_FILE)))."; \
	else \
		echo "Server is not running."; \
	fi

lint:
	@echo "Running lua-language-server..."
	@mise exec -- lua-language-server --check . --checklevel=Warning

unit-test:
	@echo "Running focused Lua unit tests..."
	@for test_file in tests/*_test.lua; do \
		$(LUNET_RUN) "$$test_file" || exit $$?; \
	done

test: start
	@echo "Running RealWorld API compatibility tests with Hurl..."
	@HOST=http://localhost:8081 bash specs/run-api-tests-hurl.sh

load-test: start
	@HOST=http://localhost:8081 sh specs/run-load-tests.sh

db-reset:
	@. ./.env; \
	PGPASSWORD=$$PGPASSWORD psql -h $$PGHOST -p $$PGPORT -U $$PGUSER -d $$PGDATABASE \
		-v ON_ERROR_STOP=1 -q \
		-c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" \
		-f sql/schema.sql \
	&& echo "Database reset."

clean:
	@if [ -f $(PID_FILE) ]; then \
		echo "ERROR: server appears to be running ($(PID_FILE) exists). Run 'make stop' first."; \
		exit 1; \
	fi
	@if [ -f $(EDGE_PID_FILE) ]; then \
		echo "ERROR: edge appears to be running ($(EDGE_PID_FILE) exists). Run 'make frontend-stop' first."; \
		exit 1; \
	fi
	@find target -mindepth 1 ! -name .keep -delete
	@echo "Cleaned target/."

help:
	@echo "Available targets:"
	@echo ""
	@echo "  make deps     - Fetch the lunet $(LUNET_TAG) release into .lunet/$(LUNET_TAG)/"
	@echo "  make init     - Check dependencies and initialize the database"
	@echo "  make db-up    - Start disposable PostgreSQL with Docker Compose"
	@echo "  make db-down  - Remove the disposable PostgreSQL data and containers"
	@echo "  make dev      - Start PostgreSQL, initialize the schema, and start the API"
	@echo "  make seed     - Create an idempotent demo user and article"
	@echo "  make lint     - Run lua-language-server static analysis"
	@echo "  make start    - Start the lunet server on port 8081"
	@echo "  make stop     - Stop the lunet server"
	@echo "  make restart  - Restart the lunet server"
	@echo "  make status   - Show server status (running/stopped)"
	@echo "  make unit-test - Run focused Lua unit tests"
	@echo "  make test     - Run RealWorld API compatibility tests with Hurl"
	@echo "  make frontend - Fetch the prebuilt frontend and serve it on port 8083"
	@echo "  make frontend-stop - Stop the edge server"
	@echo "  make bundle   - Repack release + app into a self-extracting dist/*.run"
	@echo "  make load-test - Run read-dominated load test with hey (concurrency 1 -> 64)"
	@echo "  make api-docs - Serve Swagger UI for specs/openapi.yml on port 8082"
	@echo "  make api-docs-stop - Stop the local Swagger UI container"
	@echo "  make docker-build - Build the Linux amd64 application image"
	@echo "  make db-reset - Drop and recreate the database schema"
	@echo "  make clean    - Remove runtime files in target/ (server must be stopped)"
	@echo "  make all      - Run init, lint, start, and test (default)"
	@echo "  make help     - Show this help message"
	@echo ""

.PHONY: all deps init db-up db-down dev seed api-docs api-docs-stop docker-build lint start stop restart status unit-test test load-test db-reset clean help frontend frontend-stop bundle
