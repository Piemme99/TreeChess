.PHONY: dev build stop delete logs restart

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
