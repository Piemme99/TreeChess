.PHONY: dev build stop delete logs restart prod prod-stop prod-logs prod-restart

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
	docker compose -f docker-compose.prod.yml up --build -d

prod-stop:
	docker compose -f docker-compose.prod.yml down

prod-logs:
	docker compose -f docker-compose.prod.yml logs -f

prod-restart:
	docker compose -f docker-compose.prod.yml down
	docker compose -f docker-compose.prod.yml up --build -d
