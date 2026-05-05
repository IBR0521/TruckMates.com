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
          classes: "tm-tour-step",
          cancelIcon: { enabled: true },
          scrollTo: { behavior: "smooth", block: "center" },
        },
      })

      const done = async () => {
        await markOnboardingTourCompleted()
      }

      tour.addStep({
        id: "truck-step",
        title: "Getting Started (1/4)",
        text: "Create your first truck from Vehicles to activate dispatch and route planning.",
        attachTo: { element: 'a[href="/dashboard/trucks"]', on: "right" },
        buttons: [
          { text: "Skip", action: tour.cancel, classes: "tm-tour-btn tm-tour-btn-ghost" },
          { text: "Next", action: tour.next, classes: "tm-tour-btn tm-tour-btn-primary" },
        ],
        beforeShowPromise: () => waitForElement('a[href="/dashboard/trucks"]'),
      })

      tour.addStep({
        id: "driver-step",
        title: "Add Driver (2/4)",
        text: "Add your first driver so assignments, ELD, and compliance workflows can start.",
        attachTo: { element: 'a[href="/dashboard/drivers"]', on: "right" },
        buttons: [
          { text: "Back", action: tour.back, classes: "tm-tour-btn tm-tour-btn-ghost" },
          { text: "Next", action: tour.next, classes: "tm-tour-btn tm-tour-btn-primary" },
        ],
        beforeShowPromise: () => waitForElement('a[href="/dashboard/drivers"]'),
      })

      tour.addStep({
        id: "load-step",
        title: "Create Load (3/4)",
        text: "Create your first load to start dispatch, live tracking, and settlement flow.",
        attachTo: { element: 'a[href="/dashboard/loads"]', on: "right" },
        buttons: [
          { text: "Back", action: tour.back, classes: "tm-tour-btn tm-tour-btn-ghost" },
          { text: "Next", action: tour.next, classes: "tm-tour-btn tm-tour-btn-primary" },
        ],
        beforeShowPromise: () => waitForElement('a[href="/dashboard/loads"]'),
      })

      tour.addStep({
        id: "invoice-step",
        title: "Generate Invoice (4/4)",
        text: "Finish onboarding by generating your first invoice in Accounting.",
        attachTo: { element: 'a[href="/dashboard/accounting/invoices"]', on: "right" },
        buttons: [
          { text: "Back", action: tour.back, classes: "tm-tour-btn tm-tour-btn-ghost" },
          {
            text: "Finish",
            action: () => {
              void done()
              tour.complete()
            },
            classes: "tm-tour-btn tm-tour-btn-primary",
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
