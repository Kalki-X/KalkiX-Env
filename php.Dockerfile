# Use official PHP + Apache image
FROM php:8.3-apache

# Install mysqli and pdo_mysql extensions
RUN docker-php-ext-install mysqli pdo pdo_mysql

# Enable Apache mod_rewrite (optional but often useful)
RUN a2enmod rewrite
