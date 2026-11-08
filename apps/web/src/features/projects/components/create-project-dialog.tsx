"use client";

import {
  PROJECT_TYPE_LABELS,
  PROJECT_TYPES,
  projectKeySchema,
  projectNameSchema,
  projectTypeSchema,
  suggestProjectKey,
} from "@tracklane/core";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { createProjectAction } from "../server/actions";

const schema = z.object({
  name: projectNameSchema,
  key: projectKeySchema,
  type: projectTypeSchema,
});
type Values = z.input<typeof schema>;

export function CreateProjectDialog({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [keyEdited, setKeyEdited] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", key: "", type: "scrum" },
  });
  const { executeAsync, result, reset } = useAction(createProjectAction, {
    // Visited routes stay mounted (hidden) after navigation, so close explicitly.
    onNavigation: () => setOpen(false),
  });
  const keyPreview = useWatch({ control: form.control, name: "key" });

  async function onSubmit(values: Values) {
    const res = await executeAsync({ slug, ...values });
    if (res?.serverError?.field === "key")
      form.setError("key", { message: res.serverError.message });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          form.reset();
          setKeyEdited(false);
          reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <PlusIcon aria-hidden="true" /> Create project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            Projects hold issues, a workflow and (later) boards and sprints.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {result.serverError && result.serverError.field !== "key" ? (
              <Alert variant="destructive">
                <AlertDescription>{result.serverError.message}</AlertDescription>
              </Alert>
            ) : null}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      autoFocus
                      placeholder="Payments Platform"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        if (!keyEdited)
                          form.setValue(
                            "key",
                            e.target.value.trim() ? suggestProjectKey(e.target.value) : "",
                          );
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Key</FormLabel>
                  <FormControl>
                    <Input
                      className="w-40 font-mono uppercase"
                      maxLength={10}
                      {...field}
                      onChange={(e) => {
                        setKeyEdited(true);
                        field.onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Prefix for issue keys, e.g. {(keyPreview || "PAY") + "-1"}. It can&apos;t be
                    changed later.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="grid gap-2 sm:grid-cols-2"
                    >
                      {PROJECT_TYPES.map((type) => (
                        <label
                          key={type}
                          className="flex cursor-pointer gap-3 rounded-lg border p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                        >
                          <RadioGroupItem value={type} className="mt-0.5" />
                          <span>
                            <span className="block text-sm font-medium">
                              {PROJECT_TYPE_LABELS[type].label}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {PROJECT_TYPE_LABELS[type].description}
                            </span>
                          </span>
                        </label>
                      ))}
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Loader2Icon className="animate-spin" aria-hidden="true" />
                ) : null}
                Create project
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
