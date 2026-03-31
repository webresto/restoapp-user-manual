FROM squidfunk/mkdocs-material:latest

# Установка плагина для мультиязычности
RUN pip install mkdocs-static-i18n

# Копируем всё содержимое в контейнер (хотя можно и монтировать через volume)
COPY . /docs

# Рабочая директория
WORKDIR /docs

EXPOSE 8000

# По умолчанию запускаем сервер (для разработки) или build (для статики)
ENTRYPOINT ["mkdocs"]
CMD ["serve", "--dev-addr=0.0.0.0:8000"]
