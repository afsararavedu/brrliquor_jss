import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Phone, MapPin, Clock } from "lucide-react";

export default function ContactUs() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 animate-in fade-in duration-500 select-none">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground" data-testid="text-contact-title">Contact Us</h1>
        <p className="text-muted-foreground mt-2">Get in touch with the BRR Liquor Software team for support and inquiries.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card data-testid="card-contact-email">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              Email
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm mb-1">For general inquiries and support:</p>
            <p className="font-medium" data-testid="text-contact-email">support@brrliquor.com</p>
          </CardContent>
        </Card>

        <Card data-testid="card-contact-phone">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              Phone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm mb-1">Call us during business hours:</p>
            <p className="font-medium" data-testid="text-contact-phone">+91 XXXXX XXXXX</p>
          </CardContent>
        </Card>

        <Card data-testid="card-contact-address">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              Address
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm mb-1">Our registered office:</p>
            <p className="font-medium" data-testid="text-contact-address">BRR Liquor Software Pvt Ltd.</p>
            <p className="text-sm text-muted-foreground">India</p>
          </CardContent>
        </Card>

        <Card data-testid="card-contact-hours">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              Business Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm mb-1">We are available:</p>
            <p className="font-medium" data-testid="text-contact-hours">Mon - Sat: 9:00 AM - 6:00 PM</p>
            <p className="text-sm text-muted-foreground">Sunday: Closed</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
