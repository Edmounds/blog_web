import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card"
import { Separator } from "../ui/separator"

interface HomeShadcnDemoProps {
  blogHref: string
  projectsHref: string
}

export default function HomeShadcnDemo({
  blogHref,
  projectsHref,
}: HomeShadcnDemoProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Local UI sandbox</Badge>
          <Badge variant="outline">shadcn ready</Badge>
        </div>
        <CardTitle>UI components are available on the homepage.</CardTitle>
        <CardDescription>
          A small local-only panel to confirm the React and shadcn setup is wired into Astro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Separator />
        <p className="text-sm text-muted-foreground">
          This section uses the installed button, card, badge, and separator primitives without changing the existing blog or project cards.
        </p>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-3">
        <Button asChild>
          <a href={blogHref}>Browse blogs</a>
        </Button>
        <Button asChild variant="outline">
          <a href={projectsHref}>View projects</a>
        </Button>
      </CardFooter>
    </Card>
  )
}
