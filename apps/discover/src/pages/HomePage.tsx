import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Search, Star, Users, TrendingUp, MapPin, ChevronRight } from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const card = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease } },
};

const FEATURED_PROFILES = [
  { slug: "jean-nguema-dev", name: "Jean Nguema",   title: "Développeur Web",    skills: ["React","Node.js","PostgreSQL"], city: "Yaoundé", rating: 4.8, color: "#075B32" },
  { slug: "alice-fouda-dg",  name: "Alice Fouda",   title: "Designer UI/UX",     skills: ["Figma","Tailwind","Branding"],  city: "Yaoundé", rating: 4.9, color: "#1E40AF" },
  { slug: "paul-mvondo-mkt", name: "Paul Mvondo",   title: "Marketing Digital",  skills: ["SEO","Ads","Contenu"],          city: "Yaoundé", rating: 4.7, color: "#6D28D9" },
  { slug: "ines-essogo-rh",  name: "Inès Essogo",   title: "Consultante RH",     skills: ["Recrutement","Formation","RH"], city: "Yaoundé", rating: 4.6, color: "#B45309" },
];

const STATS = [
  { label: "Profils vérifiés",  value: "120+", icon: Users },
  { label: "Domaines couverts", value: "18",   icon: TrendingUp },
  { label: "Note moyenne",      value: "4.8★", icon: Star },
];

export function HomePage() {
  return (
    <div className="space-y-8">

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        className="relative overflow-hidden rounded-3xl p-8 text-white"
        style={{ background: "linear-gradient(135deg, #063A22 0%, #075B32 60%, #0A6B3C 100%)" }}
      >
        {/* Orbes décoratifs */}
        <div aria-hidden className="absolute right-8 top-6 w-32 h-32 rounded-full opacity-20"
             style={{ background: "#D6A52B", filter: "blur(40px)" }} />
        <div aria-hidden className="absolute right-24 bottom-4 w-20 h-20 rounded-full opacity-10"
             style={{ background: "#D6A52B", filter: "blur(24px)" }} />

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-xs font-semibold tracking-widest uppercase mb-3"
          style={{ color: "#D6A52B" }}
        >
          Annuaire professionnel · Cameroun
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease, delay: 0.1 }}
          className="text-2xl sm:text-3xl font-bold mb-3 leading-tight"
        >
          Découvrez les talents<br />
          <span style={{ color: "#D6A52B" }}>de Yaoundé</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          transition={{ delay: 0.2 }}
          className="text-sm mb-6 max-w-md"
        >
          BS4U Discover connecte les professionnels et les entreprises du Cameroun.
          Trouvez l'expertise dont vous avez besoin.
        </motion.p>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease, delay: 0.25 }}
          className="relative max-w-md"
        >
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: "#66736A" }} />
          <input
            type="search"
            placeholder="Développeur web, designer, consultant…"
            className="w-full pl-10 pr-4 py-3.5 rounded-xl text-sm bg-white outline-none
                       transition-shadow focus:ring-2"
            style={{ color: "#17231C" }}
          />
        </motion.div>
      </motion.div>

      {/* Stats */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-3 gap-4"
      >
        {STATS.map(({ label, value, icon: Icon }) => (
          <motion.div
            key={label}
            variants={card}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="bg-white rounded-2xl border p-4 text-center shadow-sm"
            style={{ borderColor: "#E2E8E3" }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-3"
                 style={{ background: "#E8F3EC" }}>
              <Icon size={18} style={{ color: "#075B32" }} />
            </div>
            <p className="text-xl font-bold tabular-nums" style={{ color: "#17231C" }}>{value}</p>
            <p className="text-xs mt-0.5" style={{ color: "#66736A" }}>{label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Featured profiles */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="text-base font-semibold"
            style={{ color: "#17231C" }}
          >
            Profils en vedette
          </motion.h2>
          <Link
            to="/profils"
            className="text-xs font-medium flex items-center gap-1 hover:gap-2 transition-all"
            style={{ color: "#075B32" }}
          >
            Voir tous <ChevronRight size={12} />
          </Link>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {FEATURED_PROFILES.map(({ slug, name, title, skills, city, rating, color }) => {
            const initials = name.split(" ").map(n => n[0]).join("");
            return (
              <motion.div key={slug} variants={card} whileHover={{ y: -4, transition: { duration: 0.2 } }}>
                <Link
                  to={`/profils/${slug}`}
                  className="block bg-white rounded-2xl border p-4 shadow-sm hover:shadow-md
                             hover:border-[#075B32]/30 transition-all h-full"
                  style={{ borderColor: "#E2E8E3" }}
                >
                  {/* Avatar */}
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 font-bold text-white text-sm"
                    style={{ background: color }}
                  >
                    {initials}
                  </div>

                  <p className="font-semibold text-sm" style={{ color: "#17231C" }}>{name}</p>
                  <p className="text-xs font-medium mt-0.5" style={{ color }}>
                    {title}
                  </p>
                  <p className="text-xs flex items-center gap-1 mt-1" style={{ color: "#A0ADA5" }}>
                    <MapPin size={10} />
                    {city}
                  </p>

                  <div className="flex flex-wrap gap-1 mt-3">
                    {skills.map((s) => (
                      <span key={s} className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: "#F5F7F5", color: "#66736A" }}>
                        {s}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center gap-1">
                    <Star size={12} fill="#D6A52B" stroke="none" />
                    <span className="text-xs font-semibold" style={{ color: "#7A5A0E" }}>
                      {rating}
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
