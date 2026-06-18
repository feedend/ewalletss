import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* Se avevi altre configurazioni tue (es. domini, immagini, ecc.), lasciale qui dentro */
};

export default withPWA(nextConfig);
