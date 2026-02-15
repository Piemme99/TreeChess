.PHONY: dev build stop delete logs restart test lint test-frontend test-backend test-integration lint-frontend lint-backend install-hooks prod prod-stop prod-logs prod-restart prod-deploy prod-deploy-logs prod-deploy-stop prod-init-ssl prod-renew-ssl prod-backup prod-install-backup-cron

dev:
	docker-compose up --build -d

build:
	docker-compose build

stop:
	docker-compose down

delete:
	docker-compose down -v

logs:
	docker-compose logs -f

restart:
	docker-compose down
	docker-compose up --build -d

# === Test & Lint ===

test: test-frontend test-backend

test-frontend:
	cd frontend && npm run test:run

test-backend:
	cd backend && go test ./...

test-integration:
	cd backend && go test -tags=integration -v -timeout 300s ./tests/integration/...

lint: lint-frontend lint-backend

lint-frontend:
	cd frontend && npm run lint && npx tsc --noEmit

lint-backend:
	cd backend && go vet ./... && golangci-lint run ./...

install-hooks:
	cp scripts/pre-push .git/hooks/pre-push
	chmod +x .git/hooks/pre-push
	@echo "Git hooks installed successfully."

# === Production ===

prod:
	docker compose --env-file .env.production -f docker-compose.prod.yml up --build -d

prod-stop:
	docker compose --env-file .env.production -f docker-compose.prod.yml down

prod-logs:
	docker compose --env-file .env.production -f docker-compose.prod.yml logs -f

prod-restart:
	docker compose --env-file .env.production -f docker-compose.prod.yml down
	docker compose --env-file .env.production -f docker-compose.prod.yml up --build -d

# === Production (GHCR images, used by CD pipeline) ===

prod-deploy:
	IMAGE_TAG=$${IMAGE_TAG:-latest} docker compose --env-file .env.production -f docker-compose.prod.ghcr.yml up -d

prod-deploy-stop:
	docker compose --env-file .env.production -f docker-compose.prod.ghcr.yml down

prod-deploy-logs:
	docker compose --env-file .env.production -f docker-compose.prod.ghcr.yml logs -f

# === SSL & Backups ===

prod-init-ssl:
	@echo "Usage: make prod-init-ssl DOMAIN=yourdomain.com EMAIL=you@email.com"
	@test -n "$(DOMAIN)" || (echo "ERROR: DOMAIN is required" && exit 1)
	./scripts/init-letsencrypt.sh $(DOMAIN) $(EMAIL)

prod-renew-ssl:
	docker compose --env-file .env.production -f docker-compose.prod.yml run --rm certbot renew --dry-run

prod-backup:
	./scripts/backup.sh

prod-install-backup-cron:
	./scripts/backup.sh --install-cron
