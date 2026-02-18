import { Card, CardContent } from "@/components/ui/card";
import { Shield, Target, Users, Zap } from "lucide-react";

export default function AboutUs() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 animate-in fade-in duration-500 select-none">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground" data-testid="text-about-title">About Us</h1>
        <p className="text-muted-foreground mt-2">Learn more about BRR IT Solutions and our mission.</p>
      </div>

      <Card className="mb-8" data-testid="card-about-whoweare">
        <CardContent className="pt-6">
          <h2 className="text-xl font-bold font-display text-foreground mb-3" data-testid="text-about-whoweare">Who We Are</h2>
          <p className="text-muted-foreground leading-relaxed">
            BRR IT Solutions is a technology company dedicated to building modern, efficient software solutions
            for liquor retail and distribution businesses. Our flagship product, the BRR Liquor Soft, streamlines daily
            operations including sales tracking, inventory management, stock control, and order processing.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-bold font-display text-foreground mb-2">Our Mission</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              To empower liquor retailers with intuitive, reliable software that simplifies complex business operations and
              drives growth through data-driven insights.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-bold font-display text-foreground mb-2">Our Values</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              We believe in transparency, reliability, and customer-first development. Every feature we build is designed
              with the end user in mind, ensuring ease of use and accuracy.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-bold font-display text-foreground mb-2">What We Offer</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              A comprehensive portal for daily sales entry, order management with bulk import (CSV, Excel, PDF),
              stock tracking with automatic synchronization, and detailed reporting for business analysis.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-bold font-display text-foreground mb-2">Our Team</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              A dedicated team of developers and industry experts working together to deliver the best-in-class
              software solutions for the liquor retail industry.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
