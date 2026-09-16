async function submit() {
    if (!service || !mode || !date || !time) return;
    setSubmitting(true);
    setErrors({});
    setFormError(null);

    try {
      const result = await submitBooking({
        serviceId: service.id,
        mode,
        locationId: mode === 'in_person' ? locationId : null,
        date,
        time,
        firstName: details.firstName,
        lastName: details.lastName,
        email: details.email,
        phone: details.phone,
        address: details.address || undefined,
        emergencyName: details.emergencyName,
        emergencyPhone: details.emergencyPhone,
        reason: details.reason || undefined,
        isFirstSession: details.isFirstSession,
        paymentMethod,
        medicalAid: paymentMethod === 'medical_aid' ? medicalAid : null,
        consentTerms: consentTerms as true,
        consentAge: consentAge as true,
        clinicalConsent,
      });

      if (!result.ok) {
        setSubmitting(false);
        setErrors(result.errors ?? {});
        setFormError(result.error ?? 'Something went wrong. Please try again.');

        if (result.errors?.time) {
          setTime(null);
          setSlots(null);
          setStepIndex(steps.indexOf('time'));
          toast({ tone: 'warning', title: 'That time has just gone', description: result.error });
        }
        return;
      }

      // If no payment is required (e.g. Medical Aid with no co-pay), instantly redirect to success.
      if (!result.requiresPayment || !result.appointmentId) {
        // Fallback to hard redirect for mobile reliability
        window.location.href = `/book/confirmation?ref=${result.reference}`;
        return;
      }

      if (supportsEmbedded) {
        const payment = await startEmbeddedPayment(result.appointmentId);
        if (payment.ok) {
          setEmbedded(payment.embedded);
          setStepIndex(steps.indexOf('checkout'));
          setSubmitting(false);
          return;
        } else {
          // FIX: Handle embedded checkout failures properly so the spinner stops
          setSubmitting(false);
          setFormError(payment.error ?? 'Secure checkout could not be initialized.');
          return;
        }
      }

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }

      // Final fallback
      window.location.href = `/book/confirmation?ref=${result.reference}`;

    } catch (error) {
      console.error('Booking submission error:', error);
      // THIS SAVES THE DAY: If the network drops, turn off the spinner and show an error.
      setSubmitting(false);
      setFormError('A connection error occurred while securing your booking. Please try again.');
    }
  }