import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-dvh w-full flex items-center justify-center bg-background scanlines px-4 py-8 safe-bottom tac-page">
      <Card className="w-full max-w-md border-border bg-card">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 items-start">
            <AlertCircle className="h-8 w-8 text-red-500 shrink-0" />
            <h1 className="text-lg font-bold text-foreground tracking-wide" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              404 — ROUTE NOT FOUND
            </h1>
          </div>

          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            This path is not registered on the node. Check the URL or use the navigation menu to return to an active sector.
          </p>
          <Link href="/" className="inline-block mt-4 text-xs font-bold tracking-wider text-green-400 hover:text-green-300">
            ← RETURN TO DASHBOARD
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
