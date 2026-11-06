#!/usr/bin/env bash
# ==============================================================================
# AttendancePRO v10 — Script de Instalación Automática para Hostinger VPS KVM 2
# Sistema Operativo Recomendado: Ubuntu 22.04 LTS o Ubuntu 24.04 LTS
# ==============================================================================
# Detectar automáticamente si estamos en Attendce-Pro-Cemenquin o attendancepro
if [ -d "/var/www/Attendce-Pro-Cemenquin" ]; then
  APP_DIR="/var/www/Attendce-Pro-Cemenquin"
elif [ -d "$(pwd)/.git" ]; then
  APP_DIR="$(pwd)"
else
  APP_DIR="/var/www/Attendce-Pro-Cemenquin"
fi

PORT=3000
DOMAIN="${1:-_}" # Puedes pasar tu dominio como argumento: bash deploy-hostinger.sh nomina.tuempresa.com

echo "=================================================================="
echo " Iniciando despliegue de AttendancePRO en Hostinger VPS KVM 2 "
echo " Carpeta: ${APP_DIR}"
echo "=================================================================="

# 1. Actualizar paquetes del sistema e instalar herramientas base
echo "[1/6] Actualizando sistema e instalando Nginx, Git y Curl..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx build-essential ufw

# 2. Instalar Node.js 22 LTS (si no está instalado)
if ! command -v node &> /dev/null; then
  echo "[2/6] Instalando Node.js 22 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt install -y nodejs
else
  echo "[2/6] Node.js ya está instalado: $(node -v)"
fi

# 3. Instalar PM2 globalmente para mantener el servidor activo 24/7
if ! command -v pm2 &> /dev/null; then
  echo "[3/6] Instalando PM2..."
  sudo npm install -g pm2
else
  echo "[3/6] PM2 ya está instalado: $(pm2 -v)"
fi

# 4. Preparar carpeta del proyecto y compilar
echo "[4/6] Preparando aplicación en ${APP_DIR}..."
sudo mkdir -p "${APP_DIR}/data"
sudo chown -R "$USER":"$USER" "${APP_DIR}"

if [ "$(pwd)" != "${APP_DIR}" ]; then
  cp -r ./* "${APP_DIR}/"
  cd "${APP_DIR}"
fi

npm install --legacy-peer-deps
npm run build

# 5. Iniciar servicio con PM2
echo "[5/6] Iniciando servidor Express + API en PM2 (puerto ${PORT})..."
pm2 delete attendancepro 2>/dev/null || true
NODE_ENV=production PORT=${PORT} pm2 start npm --name "attendancepro" -- start
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u "$USER" --hp "$HOME" || true

# 6. Configurar Nginx como Reverse Proxy (con soporte para archivos de 50MB)
echo "[6/6] Configurando Nginx en puerto 80..."
sudo tee /etc/nginx/sites-available/attendancepro > /dev/null <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/attendancepro /etc/nginx/sites-enabled/attendancepro
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# Habilitar puertos en Firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

echo "=================================================================="
echo " ✓ ¡Despliegue completado con éxito!"
echo " - Base de datos persistente: ${APP_DIR}/data/portal_db.json"
echo " - Estado del servidor: pm2 status"
echo " - Logs en vivo: pm2 logs attendancepro"
echo "=================================================================="
