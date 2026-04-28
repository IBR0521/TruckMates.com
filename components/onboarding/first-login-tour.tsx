"use client"

import { useEffect } from "react"
import { getOnboardingTourStatus, markOnboardingTourCompleted } from "@/app/actions/onboarding-tour"

function waitForElement(selector: string, timeoutMs = 8000) {
  const started = Date.now()
  return new Promise<Element>((resolve, reject) => {
    const check = () => {
      const el = document.querySelector(selector)
      if (el) {
        resolve(el)
        return
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Element not found: ${selector}`))
        return
      }
      setTimeout(check, 150)
    }
    check()
  })
}

export function FirstLoginTour() {
  useEffect(() => {
    let cancelled = false

    async function launch() {
      const status = await getOnboardingTourStatus()
      if (cancelled || status.error || !status.data) return
      if (status.data.completed) return

      const shepherdModule = await import("shepherd.js")
      const Shepherd = shepherdModule.default
      const tour = new Shepherd.Tour({
        useModalOverlay: true,
        defaultStepOptions: {
          classes: "shadow-xl rounded-lg border border-border bg-card text-foreground",
          cancelIcon: { enabled: true },
          scrollTo: { behavior: "smooth", block: "center" },
        },
      })

      const done = async () => {
        await markOnboardingTourCompleted()
      }

      tour.addStep({
        id: "truck-step",
        title: "Step 1 of 4: Create your first truck",
        text: "Start by setting up your first vehicle. Click Vehicles, then add a truck.",
        attachTo: { element: 'a[href="/dashboard/trucks"]', on: "right" },
        buttons: [
          { text: "Skip tour", action: tour.cancel },
          { text: "Next", action: tour.next },
        ],
        beforeShowPromise: () => waitForElement('a[href="/dashboard/trucks"]'),
      })

      tour.addStep({
        id: "driver-step",
        title: "Step 2 of 4: Create your first driver",
        text: "Next, add your first driver so dispatch and HOS workflows can begin.",
        attachTo: { element: 'a[href="/dashboard/drivers"]', on: "right" },
        buttons: [
          { text: "Back", action: tour.back },
          { text: "Next", action: tour.next },
        ],
        beforeShowPromise: () => waitForElement('a[href="/dashboard/drivers"]'),
      })

      tour.addStep({
        id: "load-step",
        title: "Step 3 of 4: Create your first load",
        text: "Create your first load to kick off dispatch, tracking, and billing.",
        attachTo: { element: 'a[href="/dashboard/loads"]', on: "right" },
        buttons: [
          { text: "Back", action: tour.back },
          { text: "Next", action: tour.next },
        ],
        beforeShowPromise: () => waitForElement('a[href="/dashboard/loads"]'),
      })

      tour.addStep({
        id: "invoice-step",
        title: "Step 4 of 4: Generate your first invoice",
        text: "Finish your first workflow by generating an invoice in Accounting.",
        attachTo: { element: 'a[href="/dashboard/accounting/invoices"]', on: "right" },
        buttons: [
          { text: "Back", action: tour.back },
          {
            text: "Finish",
            action: () => {
              void done()
              tour.complete()
            },
          },
        ],
        beforeShowPromise: () => waitForElement('a[href="/dashboard/accounting/invoices"]'),
      })

      tour.on("cancel", () => {
        // Keep incomplete so user can relaunch automatically next session.
      })

      tour.start()
    }

    void launch()
    return () => {
      cancelled = true
    }
  }, [])

  return null
}
