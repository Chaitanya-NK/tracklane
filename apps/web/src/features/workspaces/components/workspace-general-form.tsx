"use client";

import { workspaceNameSchema, workspaceSlugSchema } from "@tracklane/core";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { updateWorkspaceAction } from "../server/actions";

const schema = z.object({ name: workspaceNameSchema, slug: workspaceSlugSchema });

export function WorkspaceGeneralForm({
  workspace,
  canEdit,
}: {
  workspace: { name: string; slug: string };
  canEdit: boolean;
}) {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: workspace.name, slug: workspace.slug },
  });
  const { executeAsync } = useAction(updateWorkspaceAction);

  async function onSubmit(values: z.infer<typeof schema>) {
    const res = await executeAsync({ currentSlug: workspace.slug, ...values });
    if (res?.serverError) {
      if (res.serverError.field === "slug")
        form.setError("slug", { message: res.serverError.message });
      else toast.error(res.serverError.message);
      return;
    }
    if (res?.data) {
      form.reset(res.data);
      toast.success("Workspace updated");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <fieldset disabled={!canEdit} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>URL</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    onChange={(e) => field.onChange(e.target.value.toLowerCase())}
                  />
                </FormControl>
                <FormDescription>
                  Changing this breaks existing links and bookmarks to the workspace.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>
        {canEdit ? (
          <Button type="submit" disabled={!form.formState.isDirty || form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <Loader2Icon className="animate-spin" aria-hidden="true" />
            ) : null}
            Save changes
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Only admins and owners can change these settings.
          </p>
        )}
      </form>
    </Form>
  );
}
