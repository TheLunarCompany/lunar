import { Loader2, Server } from "lucide-react";

type ProvisioningScreenProps = {
  message?: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ProvisioningScreen(_props: ProvisioningScreenProps) {
  return (
    <div className="w-full h-full flex items-center justify-center px-4 py-12 bg-[#F8FAFC]">
      <div className="max-w-xl w-full bg-white/90 backdrop-blur shadow-2xl rounded-2xl p-10 border border-slate-100 space-y-6 text-center">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-300">
            <Server className="w-7 h-7" />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-[0.3em]">
            Provisioning
          </p>
          <h1 className="text-3xl font-bold text-gray-900">
            Preparing your MCPX workspace
          </h1>
          <p className="text-gray-600 text-sm leading-relaxed">
            We’re requesting your dedicated MCPX instance. Once the admin has
            approved your request, your session will connect automatically.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 text-slate-700">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium"></span>
        </div>
      </div>
    </div>
  );
}
