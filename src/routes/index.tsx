import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  ssr: false,
  component: Welcome,
});

function Welcome() {
  const { session, role, signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-6 bg-brand">
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
        <BrandLogo size={220} className="shadow-xl ring-4 ring-ink/10" />
        <div>
          <h1 className="font-display text-4xl text-ink leading-tight">Barbería Melli</h1>
          <p className="text-ink/70 mt-2 text-sm font-medium">Agendá tu turno en segundos</p>
        </div>
      </div>
      <div className="w-full max-w-sm flex flex-col gap-3 pb-6">
        {session ? (
          <>
            <Link to={role === "cliente" ? "/inicio" : "/dashboard"}>
              <Button size="lg" className="w-full h-14 bg-ink text-brand hover:bg-ink/90 text-base font-semibold">
                Continuar como {session.user.email}
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="w-full h-14 border-2 border-ink text-ink bg-transparent hover:bg-ink/10 text-base font-semibold"
              onClick={async () => {
                await signOut();
                toast.success("Sesión cerrada");
              }}
            >
              Cerrar sesión
            </Button>
          </>
        ) : (
          <>
            <Link to="/auth" search={{ mode: "register" as const }}>
              <Button size="lg" className="w-full h-14 bg-ink text-brand hover:bg-ink/90 text-base font-semibold">
                Soy Cliente — crear cuenta
              </Button>
            </Link>
            <Link to="/auth" search={{ mode: "login" as const }}>
              <Button
                size="lg"
                variant="outline"
                className="w-full h-14 border-2 border-ink text-ink bg-transparent hover:bg-ink/10 text-base font-semibold"
              >
                Ya tengo cuenta — iniciar sesión
              </Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-6 bg-brand">
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-6">
        <BrandLogo size={220} className="shadow-xl ring-4 ring-ink/10" />
        <div>
          <h1 className="font-display text-4xl text-ink leading-tight">Barbería Melli</h1>
          <p className="text-ink/70 mt-2 text-sm font-medium">Agendá tu turno en segundos</p>
        </div>
      </div>
      <div className="w-full max-w-sm flex flex-col gap-3 pb-6">
        <Link to="/auth" search={{ mode: "register" as const }}>
          <Button size="lg" className="w-full h-14 bg-ink text-brand hover:bg-ink/90 text-base font-semibold">
            Soy Cliente — crear cuenta
          </Button>
        </Link>
        <Link to="/auth" search={{ mode: "login" as const }}>
          <Button
            size="lg"
            variant="outline"
            className="w-full h-14 border-2 border-ink text-ink bg-transparent hover:bg-ink/10 text-base font-semibold"
          >
            Ya tengo cuenta — iniciar sesión
          </Button>
        </Link>
      </div>
    </div>
  );
}
