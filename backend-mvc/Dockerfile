FROM postgres

ENV POSTGRES_PASSWORD docker
ENV POSTGRES_DB user

COPY user.sql /docker-entrypoint-initdb.d/
