import { useParams, Link } from "react-router-dom";
import { ArrowLeft, MapPin, Mail, ExternalLink } from "lucide-react";

export function ProfileDetail() {
  const { slug } = useParams();
  return (
    <div>
      <Link to="/profils" className="flex items-center gap-2 text-sm text-[#66736A] hover:text-[#075B32] mb-4 w-fit">
        <ArrowLeft className="w-4 h-4" />
        Talents
      </Link>
      <div className="bg-white rounded-xl border border-[#E2E8E3] p-6">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-16 h-16 rounded-full bg-[#E8F3EC] flex items-center justify-center shrink-0">
            <span className="text-[#075B32] font-bold text-xl">JN</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#17231C]">Jean Nguema</h1>
            <p className="text-sm text-[#066D3B] font-medium">Développeur Web</p>
            <div className="flex items-center gap-1 text-xs text-[#66736A] mt-1">
              <MapPin className="w-3 h-3" />
              Yaoundé, Cameroun
            </div>
          </div>
        </div>
        <p className="text-sm text-[#17231C] mb-4">
          Développeur web full-stack avec 5 ans d'expérience. Spécialisé en React, Node.js et PostgreSQL. Passionné par les solutions locales pour l'Afrique.
        </p>
        <p className="text-xs text-[#66736A]">Profil complet disponible en LOT 13 — slug: {slug}</p>
      </div>
    </div>
  );
}
