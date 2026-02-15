package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v5"
)

func HealthHandler(pool *pgxpool.Pool) echo.HandlerFunc {
	return func(c *echo.Context) error {
		status := "ok"
		httpStatus := http.StatusOK

		if pool != nil {
			ctx, cancel := context.WithTimeout(c.Request().Context(), 2*time.Second)
			defer cancel()

			if err := pool.Ping(ctx); err != nil {
				status = "degraded"
				httpStatus = http.StatusServiceUnavailable
			}
		} else {
			status = "degraded"
			httpStatus = http.StatusServiceUnavailable
		}

		return c.JSON(httpStatus, map[string]string{
			"status": status,
		})
	}
}
