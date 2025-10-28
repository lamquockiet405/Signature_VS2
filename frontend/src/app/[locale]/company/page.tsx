"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ToastProvider";
import { Facebook, Twitter, Linkedin, Instagram, Edit } from "lucide-react";
import { companyAPI } from "@/lib/api";
import { useTranslations } from "next-intl";

export default function CompanyProfilePage() {
  const toast = useToast();
  const t = useTranslations();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyData, setCompanyData] = useState({
    name: "",
    tax_code: "",
    email: "",
    phone: "",
    address: "",
    website: "",
    logo_url: "",
  });
  const [originalData, setOriginalData] = useState(companyData);

  const fetchCompanyData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await companyAPI.get();
      setCompanyData({
        name: data.name || "",
        tax_code: data.tax_code || "",
        email: data.email || "",
        phone: data.phone || "",
        address: data.address || "",
        website: data.website || "",
        logo_url: data.logo_url || "",
      });
      setOriginalData({
        name: data.name || "",
        tax_code: data.tax_code || "",
        email: data.email || "",
        phone: data.phone || "",
        address: data.address || "",
        website: data.website || "",
        logo_url: data.logo_url || "",
      });
    } catch (error) {
      console.error("Error fetching company data:", error);
      toast.error("Failed to load company information");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Fetch company data on mount
  useEffect(() => {
    fetchCompanyData();
  }, [fetchCompanyData]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await companyAPI.update(companyData);
      setOriginalData(companyData);
      setIsEditing(false);
      toast.success("Company information updated successfully!");
    } catch (error) {
      console.error("Error updating company data:", error);
      toast.error("Failed to update company information");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setCompanyData(originalData);
    setIsEditing(false);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-gray-500">{t("company.loading")}</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header with Breadcrumb */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {t("company.companyProfile")}
        </h1>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="hover:text-gray-700 cursor-pointer">
            {t("navigation.home")}
          </span>
          <span>&gt;</span>
          <span className="text-gray-900">{t("company.companyProfile")}</span>
        </div>
      </div>

      {/* Main Container with border */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        {/* My Profile Card */}
        <div className="bg-gray-50 rounded-lg border border-gray-200 shadow-sm mb-6">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              {t("company.myProfile")}
            </h2>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white text-xl font-bold">
                    TC
                  </div>
                </div>

                {/* Company Info */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {companyData.name}
                  </h3>
                  <p className="text-sm text-gray-500">{companyData.address}</p>
                  <p className="text-xs text-gray-400 mt-1">Company</p>
                </div>
              </div>

              {/* Social Media & Edit Button */}
              <div className="flex items-center gap-3">
                <button className="p-2 border border-gray-300 hover:bg-gray-100 rounded-full transition-colors">
                  <Facebook size={20} className="text-gray-600" />
                </button>
                <button className="p-2 border border-gray-300 hover:bg-gray-100 rounded-full transition-colors">
                  <Twitter size={20} className="text-gray-600" />
                </button>
                <button className="p-2 border border-gray-300 hover:bg-gray-100 rounded-full transition-colors">
                  <Linkedin size={20} className="text-gray-600" />
                </button>
                <button className="p-2 border border-gray-300 hover:bg-gray-100 rounded-full transition-colors">
                  <Instagram size={20} className="text-gray-600" />
                </button>
                <button
                  onClick={isEditing ? handleCancel : () => setIsEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm ml-3"
                >
                  <Edit size={16} />
                  {isEditing ? t("company.cancel") : t("company.edit")}
                </button>
                {isEditing && (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:bg-blue-400"
                  >
                    {saving ? t("company.saving") : t("company.save")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Information Card */}
        <div className="bg-gray-50 rounded-lg border border-gray-200 shadow-sm">
          {/* Information Section */}
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-base font-semibold text-gray-900 mb-6">
              {t("company.information")}
            </h3>

            <div className="grid grid-cols-2 gap-6">
              {/* Company Name */}
              <div>
                <label className="block text-sm text-gray-500 mb-2">
                  {t("company.companyName")}
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={companyData.name}
                    onChange={(e) =>
                      setCompanyData({ ...companyData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-sm text-gray-900">{companyData.name}</p>
                )}
              </div>

              {/* Tax ID */}
              <div>
                <label className="block text-sm text-gray-500 mb-2">
                  {t("company.taxCode")}
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={companyData.tax_code}
                    onChange={(e) =>
                      setCompanyData({
                        ...companyData,
                        tax_code: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-sm text-gray-900">
                    {companyData.tax_code}
                  </p>
                )}
              </div>

              {/* Email address */}
              <div>
                <label className="block text-sm text-gray-500 mb-2">
                  {t("company.emailAddress")}
                </label>
                {isEditing ? (
                  <input
                    type="email"
                    value={companyData.email}
                    onChange={(e) =>
                      setCompanyData({ ...companyData, email: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-sm text-gray-900">{companyData.email}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm text-gray-500 mb-2">
                  {t("company.phone")}
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={companyData.phone}
                    onChange={(e) =>
                      setCompanyData({ ...companyData, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-sm text-gray-900">{companyData.phone}</p>
                )}
              </div>

              {/* Website */}
              <div>
                <label className="block text-sm text-gray-500 mb-2">
                  {t("company.website")}
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={companyData.website}
                    onChange={(e) =>
                      setCompanyData({
                        ...companyData,
                        website: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com"
                  />
                ) : (
                  <p className="text-sm text-gray-900">
                    {companyData.website || "N/A"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Address Card */}
        <div className="bg-gray-50 rounded-lg border border-gray-200 shadow-sm mt-6">
          <div className="p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-6">
              {t("company.address")}
            </h3>

            <div className="grid grid-cols-1 gap-6">
              {/* Full Address */}
              <div>
                <label className="block text-sm text-gray-500 mb-2">
                  {t("company.fullAddress")}
                </label>
                {isEditing ? (
                  <textarea
                    value={companyData.address}
                    onChange={(e) =>
                      setCompanyData({
                        ...companyData,
                        address: e.target.value,
                      })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={t("company.enterFullAddress")}
                  />
                ) : (
                  <p className="text-sm text-gray-900">
                    {companyData.address || "N/A"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* End Main Container */}
      </div>
    </div>
  );
}
