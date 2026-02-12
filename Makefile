.PHONY: dev build stop delete logs restart prod prod-stop prod-logs prod-restart prod-init-ssl prod-renew-ssl prod-backup prod-install-backup-cron

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
