import { Compass } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="rounded-xl border border-border bg-surface shadow-sm">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you are looking for does not exist or has been moved."
        action={
          <Button onClick={() => navigate("/")} className="mt-1">
            Back to dashboard
          </Button>
        }
      />
    </div>
  );
}
