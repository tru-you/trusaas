FROM nginx:alpine

# Copy static web assets, PWA manifest, and service worker
COPY . /usr/share/nginx/html

# Expose standard web port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
